import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import {
  PROTOCOL_VERSION,
  parseDatasetImportResult,
  parseDatasetList,
  parseDatasetPreview,
  parseDatasetReplacementResult,
  parseRpcResponse,
} from "../packages/contracts/dist/index.js";

const root = await mkdtemp(resolve(tmpdir(), "bubu-data-core-smoke-"));
const dataDirectory = resolve(root, "data");
const sourcePath = resolve(root, "synthetic-sales.csv");
const replacementPath = resolve(root, "synthetic-sales-week-2.csv");
const driftedPath = resolve(root, "synthetic-sales-drifted.csv");
const executable = resolve("services", "data-core", "bin", "bubu-data-core");
const auth = randomBytes(32).toString("hex");
let stderr = "";

await writeFile(
  sourcePath,
  "Order ID,Region,Amount,Date\n001,North,128.50,2026-07-15\n002,South,256.00,2026-07-16\n003,North,64.25,2026-07-17\n",
  { mode: 0o600 },
);
await writeFile(
  replacementPath,
  "Order ID,Region,Amount,Date\n004,West,512.00,2026-07-18\n005,North,32.00,2026-07-19\n",
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
  if (replacedPreview.rows[0]?.[0] !== "004" || replacedPreview.totalRows !== 2) {
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
  for (const privatePath of [sourcePath, replacementPath, driftedPath]) {
    if (databaseBytes.includes(Buffer.from(privatePath))) {
      throw new Error("Database persisted an absolute source path");
    }
  }

  console.log("Data-core smoke passed: import, catalog, inference, preview, replacement, drift, and path privacy.");
} finally {
  if (child.exitCode === null) child.kill();
  await rm(root, { recursive: true, force: true });
}
