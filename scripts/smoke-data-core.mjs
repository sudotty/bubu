import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  PROTOCOL_VERSION,
  parseDatasetImportResult,
  parseDatasetExportResult,
  parseDatasetDeletionResult,
  parseDatasetGroup,
  parseDatasetGroupList,
  parseConversationThread,
  parseDatasetList,
  parseDatasetPreview,
  parseDatasetReplacementResult,
  parseDatasetQualityReport,
  parseDatasetRelationship,
  parseGroupRelationshipOverview,
  parseModelContext,
  parseRpcResponse,
  parseSafeQueryResult,
  parseSafeGroupQueryResult,
} from "../packages/contracts/dist/index.js";

const root = await mkdtemp(resolve(tmpdir(), "bubu-data-core-smoke-"));
const dataDirectory = resolve(root, "data");
const sourcePath = resolve(root, "synthetic-sales.csv");
const replacementPath = resolve(root, "synthetic-sales-week-2.csv");
const driftedPath = resolve(root, "synthetic-sales-drifted.csv");
const targetsPath = resolve(root, "synthetic-targets.csv");
const exportPath = resolve(root, "safe-export.csv");
const executable = resolve("services", "data-core", "bin", "bubu-data-core");
const auth = randomBytes(32).toString("hex");
let stderr = "";

await writeFile(
  sourcePath,
  "Order ID,Region,Amount,Date\n001,North,128.50,2026-07-15\n002,South,256.00,2026-07-16\n003,North,64.25,2026-07-17\n",
  { mode: 0o600 },
);
await writeFile(
  targetsPath,
  "Region,Target\nWest,600\nNorth,50\n",
  { mode: 0o600 },
);
await writeFile(
  replacementPath,
  "Order ID,Region,Amount,Date\nRAW-ORDER-004,West,512.00,2026-07-18\nRAW-ORDER-005,North,32.00,2026-07-19\n",
  { mode: 0o600 },
);
await writeFile(
  driftedPath,
  "Order ID,Zone,Amount,Date\n006,East,12.00,2026-07-20\n",
  { mode: 0o600 },
);

const child = spawn(executable, [], {
  env: { ...process.env, BUBU_RPC_TOKEN: auth, BUBU_DATA_DIR: dataDirectory },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const lines = createInterface({ input: child.stdout });
const pending = new Map();
lines.on("line", (line) => {
  let response;
  try {
    response = parseRpcResponse(JSON.parse(line));
  } catch (error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    return;
  }
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  if (response.ok) request.resolve(response.result);
  else request.reject(new Error(`${response.error.code}: ${response.error.message}`));
});

let sequence = 0;
function request(method, params) {
  const id = `smoke-${++sequence}`;
  return new Promise((resolveRequest, rejectRequest) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      rejectRequest(new Error(`Timed out waiting for ${method}`));
    }, 10_000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolveRequest(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        rejectRequest(error);
      },
    });
    child.stdin.write(`${JSON.stringify({ protocolVersion: PROTOCOL_VERSION, auth, id, method, params })}\n`);
  });
}

try {
  await request("system.health", {});
  const importedRaw = await request("dataset.import.batch", { sourcePaths: [sourcePath] });
  const imported = parseDatasetImportResult(importedRaw);
  if (JSON.stringify(importedRaw).includes(sourcePath)) {
    throw new Error("Data-core response disclosed the absolute source path");
  }
  if (imported.datasets.length !== 1) throw new Error("Expected one imported dataset");
  const dataset = imported.datasets[0];
  if (dataset.rowCount !== 3 || dataset.columnCount !== 4) {
    throw new Error(`Unexpected imported shape: ${dataset.rowCount}x${dataset.columnCount}`);
  }

  const datasets = parseDatasetList(await request("dataset.list", {}));
  if (datasets.length !== 1 || datasets[0]?.id !== dataset.id) {
    throw new Error("Imported dataset is missing from the catalog");
  }

  const preview = parseDatasetPreview(
    await request("dataset.preview", { datasetId: dataset.id, limit: 50, offset: 0 }),
  );
  const types = preview.columns.map((column) => column.inferredType).join(",");
  if (types !== "text,text,real,datetime") {
    throw new Error(`Unexpected inferred types: ${types}`);
  }
  if (preview.rows[0]?.[0] !== "001" || preview.rows[2]?.[2] !== "64.25") {
    throw new Error("Preview did not preserve source values");
  }

  const replacement = parseDatasetReplacementResult(
    await request("dataset.replace", { datasetId: dataset.id, sourcePath: replacementPath }),
  );
  if (replacement.status !== "replaced" || replacement.dataset.version !== 2) {
    throw new Error("Replacement did not advance the immutable dataset version");
  }
  const replacedPreview = parseDatasetPreview(
    await request("dataset.preview", { datasetId: dataset.id, limit: 50, offset: 0 }),
  );
  if (replacedPreview.rows[0]?.[0] !== "RAW-ORDER-004" || replacedPreview.totalRows !== 2) {
    throw new Error("Replacement did not atomically switch the current preview");
  }
  const drifted = parseDatasetReplacementResult(
    await request("dataset.replace", { datasetId: dataset.id, sourcePath: driftedPath }),
  );
  if (
    drifted.status !== "mapping-required" ||
    drifted.drift.missingColumns.join(",") !== "Region" ||
    drifted.drift.addedColumns.join(",") !== "Zone"
  ) {
    throw new Error("Schema drift did not block incompatible replacement");
  }
  const modelContext = parseModelContext(
    await request("dataset.context", {
      datasetId: dataset.id,
      disclosure: "schema-synthetic",
    }),
  );
  const disclosed = JSON.stringify(modelContext);
  for (const forbidden of ["RAW-ORDER-004", "West", "512.00", replacementPath]) {
    if (disclosed.includes(forbidden)) {
      throw new Error(`Model context disclosed a real source value: ${forbidden}`);
    }
  }
  if (modelContext.syntheticRows.length !== 3) {
    throw new Error("Model context is missing bounded synthetic examples");
  }
  const singlePlan = {
    schemaVersion: 1,
    datasetId: dataset.id,
    versionId: replacement.dataset.versionId,
    purpose: "Sum amount by region",
    dimensions: ["Region"],
    measures: [{ operation: "sum", column: "Amount" }],
    filters: [],
    sort: [{ outputIndex: 1, direction: "descending" }],
    limit: 10,
  };
  const queryResult = parseSafeQueryResult(
    await request("dataset.query.execute", {
      plan: singlePlan,
    }),
  );
  if (queryResult.rows[0]?.[0] !== "West" || queryResult.rows[0]?.[1] !== 512) {
    throw new Error(`Safe query returned an unexpected result: ${JSON.stringify(queryResult.rows)}`);
  }
  const conversationTarget = { kind: "dataset", id: dataset.id };
  await request("conversation.append", {
    input: {
      target: conversationTarget,
      entry: { kind: "question", role: "user", payload: { question: "Sum amount by region" } },
    },
  });
  await request("conversation.append", {
    input: {
      target: conversationTarget,
      entry: {
        kind: "plan",
        role: "assistant",
        payload: {
          proposal: {
            question: "Sum amount by region",
            disclosedContext: modelContext,
            plan: singlePlan,
          },
        },
      },
    },
  });
  const conversation = parseConversationThread(
    await request("conversation.append", {
      input: {
        target: conversationTarget,
        entry: { kind: "result", role: "assistant", payload: { result: queryResult } },
      },
    }),
  );
  const reloadedConversation = parseConversationThread(
    await request("conversation.get", { target: conversationTarget }),
  );
  if (conversation.entries.length !== 3 || reloadedConversation.entries[2]?.kind !== "result") {
    throw new Error("Local conversation did not preserve question, plan, and result in order");
  }
  const targetImport = parseDatasetImportResult(
    await request("dataset.import.batch", { sourcePaths: [targetsPath] }),
  );
  const group = parseDatasetGroup(
    await request("dataset.group.save", {
      name: "Synthetic comparison",
      datasetIds: [dataset.id, targetImport.datasets[0].id],
    }),
  );
  const groups = parseDatasetGroupList(await request("dataset.group.list", {}));
  if (groups.length !== 1 || group.members.length !== 2 || groups[0]?.id !== group.id) {
    throw new Error("Dataset group was not persisted with two current members");
  }
  const relationshipDiscovery = parseGroupRelationshipOverview(
    await request("dataset.group.relationships", { groupId: group.id }),
  );
  const lookupCandidate = relationshipDiscovery.candidates.find(({ left, right }) =>
    left.datasetId === dataset.id && right.datasetId === targetImport.datasets[0].id,
  );
  if (!lookupCandidate) {
    throw new Error("Local relationship discovery did not find the unique right-side Region key");
  }
  const savedRelationship = parseDatasetRelationship(
    await request("dataset.relationship.save", {
      input: { left: lookupCandidate.left, right: lookupCandidate.right },
    }),
  );
  const relationshipOverview = parseGroupRelationshipOverview(
    await request("dataset.group.relationships", { groupId: group.id }),
  );
  if (savedRelationship.status !== "ready" || relationshipOverview.relationships.length !== 1) {
    throw new Error("Reusable dataset relationship was not persisted as ready");
  }
  const groupQueryResult = parseSafeGroupQueryResult(
    await request("dataset.group.query.execute", {
      plan: {
        schemaVersion: 1,
        groupId: group.id,
        purpose: "Look up regional targets",
        sources: group.members.map(({ id, versionId }) => ({ datasetId: id, versionId })),
        joins: [{
          leftSourceIndex: 0,
          leftColumn: "Region",
          rightSourceIndex: 1,
          rightColumn: "Region",
          type: "left",
        }],
        dimensions: [
          { sourceIndex: 0, column: "Region" },
          { sourceIndex: 1, column: "Target" },
        ],
        measures: [{ operation: "sum", sourceIndex: 0, column: "Amount" }],
        filters: [],
        sort: [{ outputIndex: 2, direction: "descending" }],
        limit: 10,
      },
    }),
  );
  if (
    groupQueryResult.rows[0]?.[0] !== "West" ||
    groupQueryResult.rows[0]?.[1] !== "600" ||
    groupQueryResult.rows[0]?.[2] !== 512
  ) {
    throw new Error(`Safe group query returned an unexpected result: ${JSON.stringify(groupQueryResult.rows)}`);
  }

  const mappedReplacement = parseDatasetReplacementResult(
    await request("dataset.replace.mapped", {
      datasetId: dataset.id,
      sourcePath: driftedPath,
      mappings: [
        { currentColumn: "Order ID", incomingColumn: "Order ID" },
        { currentColumn: "Region", incomingColumn: "Zone" },
        { currentColumn: "Amount", incomingColumn: "Amount" },
        { currentColumn: "Date", incomingColumn: "Date" },
      ],
    }),
  );
  if (mappedReplacement.status !== "replaced" || mappedReplacement.dataset.version !== 3) {
    throw new Error("Mapped replacement did not advance the immutable version");
  }
  const mappedPreview = parseDatasetPreview(
    await request("dataset.preview", { datasetId: dataset.id, limit: 50, offset: 0 }),
  );
  if (mappedPreview.columns[1]?.name !== "Region" || mappedPreview.rows[0]?.[1] !== "East") {
    throw new Error("Mapped replacement did not preserve the stable logical schema");
  }
  const qualityReport = parseDatasetQualityReport(
    await request("dataset.validation.save", {
      input: {
        datasetId: dataset.id,
        rules: [
          { kind: "required", column: "Region" },
          { kind: "allowed-values", column: "Region", values: ["West", "North"] },
        ],
      },
    }),
  );
  if (
    qualityReport.versionId !== mappedReplacement.dataset.versionId ||
    qualityReport.validation[0]?.failedRows !== 0 ||
    qualityReport.validation[1]?.failedRows !== 1 ||
    qualityReport.validation[1]?.sampleRowNumbers[0] !== 1
  ) {
    throw new Error("Local validation rules did not persist and run on the current version");
  }

  const exportedRaw = await request("dataset.export", {
    datasetId: dataset.id,
    targetPath: exportPath,
  });
  const exported = parseDatasetExportResult(exportedRaw);
  if (JSON.stringify(exportedRaw).includes(exportPath) || exported.fileName !== "safe-export.csv") {
    throw new Error("Dataset export disclosed its private destination path");
  }
  const exportedContents = await readFile(exportPath, "utf8");
  if (!exportedContents.includes("Order ID,Region,Amount,Date") || !exportedContents.includes("006,East,12.00")) {
    throw new Error("Dataset export did not stream the mapped current version");
  }

  const deletion = parseDatasetDeletionResult(
    await request("dataset.delete", { datasetId: targetImport.datasets[0].id }),
  );
  if (deletion.removedGroupIds[0] !== group.id || deletion.updatedGroupIds.length !== 0) {
    throw new Error(`Dataset deletion did not repair the affected group: ${JSON.stringify(deletion)}`);
  }
  const remainingDatasets = parseDatasetList(await request("dataset.list", {}));
  const remainingGroups = parseDatasetGroupList(await request("dataset.group.list", {}));
  if (remainingDatasets.length !== 1 || remainingDatasets[0]?.id !== dataset.id || remainingGroups.length !== 0) {
    throw new Error("Dataset deletion left stale catalog or group state");
  }

  child.stdin.end();
  const exitCode = await new Promise((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("exit", resolveExit);
  });
  if (exitCode !== 0) throw new Error(`Data core exited ${exitCode}: ${stderr.trim()}`);

  const databasePath = resolve(dataDirectory, "bubu.db");
  const database = await stat(databasePath);
  if ((database.mode & 0o777) !== 0o600) {
    throw new Error(`Database permissions are ${(database.mode & 0o777).toString(8)}, want 600`);
  }
  const databaseBytes = await readFile(databasePath);
  for (const privatePath of [sourcePath, replacementPath, driftedPath, targetsPath]) {
    if (databaseBytes.includes(Buffer.from(privatePath))) {
      throw new Error("Database persisted an absolute source path");
    }
  }

  console.log("Data-core smoke passed: import, preview, immutable and mapped replacement, local quality/validation, reusable relationships, safe export/deletion, drift, groups, local conversation, synthetic disclosure, safe single/group queries, and path privacy.");
} finally {
  if (child.exitCode === null) child.kill();
  await rm(root, { recursive: true, force: true });
}
