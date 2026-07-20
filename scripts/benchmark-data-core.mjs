import { spawn, execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { arch, cpus, freemem, platform, release, tmpdir, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import {
  PROTOCOL_VERSION,
  parseDatasetImportResult,
  parseRpcResponse,
  parseSafeQueryResult,
} from "../packages/contracts/dist/index.js";
import { dataCoreBinaryPath } from "./platform-paths.mjs";

const MiB = 1024 * 1024;
const options = parseOptions(process.argv.slice(2));
const workspace = await mkdtemp(resolve(tmpdir(), "bubu-performance-"));
const sourcePath = resolve(workspace, "reference-100mb.csv");
const dataDirectory = resolve(workspace, "data");
const executable = dataCoreBinaryPath();
const auth = randomBytes(32).toString("hex");
let child;
let stderr = "";

try {
  const generated = await generateCsv(sourcePath, options.sizeMiB * MiB);
  if (generated.rows < options.minimumRows) {
    throw new Error(`Generated only ${generated.rows} rows; minimum is ${options.minimumRows}`);
  }

  child = spawn(executable, [], {
    env: { ...process.env, BUBU_RPC_TOKEN: auth, BUBU_DATA_DIR: dataDirectory },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const rpc = createRpcClient(child, auth);
  const memory = sampleResidentMemory(child.pid);

  await rpc.request("system.health", {}, 10_000);
  const importStarted = performance.now();
  const imported = parseDatasetImportResult(
    await rpc.request("dataset.import.batch", { sourcePaths: [sourcePath] }, options.maxImportMs + 30_000),
  );
  const importMs = performance.now() - importStarted;
  const dataset = imported.datasets[0];
  if (!dataset || imported.datasets.length !== 1) throw new Error("Reference import did not produce one dataset");
  if (dataset.rowCount !== generated.rows) {
    throw new Error(`Imported ${dataset.rowCount} rows, expected ${generated.rows}`);
  }

  const plan = {
    schemaVersion: 1,
    datasetId: dataset.id,
    versionId: dataset.versionId,
    purpose: "Reference regional sales aggregation",
    dimensions: ["Region"],
    measures: [
      { operation: "sum", column: "Amount" },
      { operation: "average", column: "Quantity" },
      { operation: "count", column: null },
    ],
    filters: [{ column: "Status", operator: "not-equals", value: "Cancelled" }],
    sort: [{ outputIndex: 1, direction: "descending" }],
    limit: 20,
  };
  parseSafeQueryResult(await rpc.request("dataset.query.execute", { plan }, 30_000));
  const querySamplesMs = [];
  for (let index = 0; index < options.querySamples; index++) {
    const queryStarted = performance.now();
    const result = parseSafeQueryResult(
      await rpc.request("dataset.query.execute", { plan }, options.maxQueryP95Ms + 10_000),
    );
    querySamplesMs.push(performance.now() - queryStarted);
    if (result.rows.length !== 8 || result.columns.length !== 4) {
      throw new Error(`Reference query returned ${result.rows.length}x${result.columns.length}, expected 8x4`);
    }
  }
  const queryP95Ms = percentile(querySamplesMs, 0.95);
  const database = await stat(resolve(dataDirectory, "bubu.db"));
  const peakRssMiB = memory.stop();

  rpc.closeInput();
  const exitCode = await waitForExit(child);
  child = undefined;
  if (exitCode !== 0) throw new Error(`Data core exited ${exitCode}: ${stderr.trim()}`);

  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    revision: gitRevision(),
    device: deviceSummary(),
    fixture: {
      bytes: generated.bytes,
      mebibytes: round(generated.bytes / MiB),
      rows: generated.rows,
      columns: 10,
      generationMs: round(generated.generationMs),
    },
    dataCore: {
      databaseBytes: database.size,
      databaseMebibytes: round(database.size / MiB),
      peakResidentMemoryMebibytes: peakRssMiB,
    },
    timings: {
      importAndProfileMs: round(importMs),
      querySamplesMs: querySamplesMs.map(round),
      queryP95Ms: round(queryP95Ms),
    },
    budgets: {
      minimumFixtureMebibytes: options.sizeMiB,
      minimumRows: options.minimumRows,
      maximumImportAndProfileMs: options.maxImportMs,
      maximumQueryP95Ms: options.maxQueryP95Ms,
      maximumPeakResidentMemoryMebibytes: options.maxRssMiB,
    },
  };

  const failures = [];
  if (generated.bytes < options.sizeMiB * MiB) failures.push("fixture is smaller than the required size");
  if (importMs > options.maxImportMs) failures.push(`import/profile ${round(importMs)} ms exceeds ${options.maxImportMs} ms`);
  if (queryP95Ms > options.maxQueryP95Ms) failures.push(`query p95 ${round(queryP95Ms)} ms exceeds ${options.maxQueryP95Ms} ms`);
  if (peakRssMiB !== null && peakRssMiB > options.maxRssMiB) failures.push(`peak RSS ${peakRssMiB} MiB exceeds ${options.maxRssMiB} MiB`);

  if (options.evidencePath) {
    await writeEvidence(options.evidencePath, report);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) throw new Error(`Performance verification failed: ${failures.join("; ")}`);
  process.stdout.write("Data-core performance verification passed.\n");
} finally {
  if (child) child.kill("SIGKILL");
  if (!process.env.BUBU_PERF_KEEP_TEMP) await rm(workspace, { recursive: true, force: true });
}

function parseOptions(arguments_) {
  const values = new Map(arguments_.map((argument) => {
    const match = /^--([^=]+)=(.+)$/u.exec(argument);
    if (!match) throw new Error(`Invalid benchmark argument: ${argument}`);
    return [match[1], match[2]];
  }));
  const allowed = new Set([
    "size-mib",
    "minimum-rows",
    "max-import-ms",
    "max-query-p95-ms",
    "max-rss-mib",
    "query-samples",
    "evidence",
  ]);
  for (const name of values.keys()) {
    if (!allowed.has(name)) throw new Error(`Unknown benchmark option: ${name}`);
  }
  const number = (name, fallback) => {
    const value = Number(values.get(name) ?? fallback);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
    return value;
  };
  const sizeMiB = number("size-mib", 100);
  if (sizeMiB < 100 || sizeMiB > 1_024) {
    throw new Error("Reference performance verification requires 100–1024 MiB");
  }
  const querySamples = Math.ceil(number("query-samples", 5));
  if (querySamples > 20) throw new Error("query-samples cannot exceed 20");
  return {
    sizeMiB,
    minimumRows: Math.ceil(number("minimum-rows", 100_000)),
    maxImportMs: number("max-import-ms", 120_000),
    maxQueryP95Ms: number("max-query-p95-ms", 3_000),
    maxRssMiB: number("max-rss-mib", 768),
    querySamples,
    evidencePath: values.get("evidence"),
  };
}

async function generateCsv(path, targetBytes) {
  const started = performance.now();
  const output = createWriteStream(path, { encoding: "utf8", mode: 0o600 });
  const header = "Order ID,Region,Category,Amount,Quantity,Order Date,Customer Segment,Status,Channel,Notes\n";
  let bytes = Buffer.byteLength(header);
  let rows = 0;
  output.write(header);
  const regions = ["North", "South", "East", "West", "Central", "Northeast", "Southwest", "Northwest"];
  const categories = ["Office", "Hardware", "Software", "Service", "Logistics", "Subscription"];
  const segments = ["Consumer", "Small Business", "Mid-Market", "Enterprise", "Public Sector"];
  const statuses = ["Paid", "Pending", "Refunded", "Cancelled"];
  const channels = ["Direct", "Partner", "Marketplace", "Retail"];
  const noteBase = "Deterministic reference workload for local private spreadsheet analysis and profiling. ";
  const notes = categories.map((category) => `${category}: ${(noteBase + category + " ").repeat(5)}`);
  while (bytes < targetBytes) {
    const batch = [];
    for (let offset = 0; offset < 1_000 && bytes < targetBytes; offset++) {
      rows++;
      const categoryIndex = rows % categories.length;
      const date = new Date(Date.UTC(2024 + (rows % 3), rows % 12, (rows % 28) + 1)).toISOString().slice(0, 10);
      const row = [
        `ORD-${String(rows).padStart(9, "0")}`,
        regions[rows % regions.length],
        categories[categoryIndex],
        ((rows % 100_000) / 100 + 1).toFixed(2),
        String((rows % 10) + 1),
        date,
        segments[rows % segments.length],
        statuses[(rows * 7 + Math.floor(rows / 11)) % statuses.length],
        channels[rows % channels.length],
        notes[categoryIndex],
      ].join(",") + "\n";
      batch.push(row);
      bytes += Buffer.byteLength(row);
    }
    if (!output.write(batch.join(""))) await once(output, "drain");
  }
  output.end();
  await once(output, "close");
  const file = await stat(path);
  return { bytes: file.size, rows, generationMs: performance.now() - started };
}

function createRpcClient(process, token) {
  const pending = new Map();
  let sequence = 0;
  const lines = createInterface({ input: process.stdout });
  lines.on("line", (line) => {
    let response;
    try {
      response = parseRpcResponse(JSON.parse(line));
    } catch (error) {
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
      return;
    }
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) entry.resolve(response.result);
    else entry.reject(new Error(`${response.error.code}: ${response.error.message}`));
  });
  return {
    request(method, params, timeoutMs) {
      const id = `performance-${++sequence}`;
      return new Promise((resolveRequest, rejectRequest) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectRequest(new Error(`Timed out waiting for ${method}`));
        }, timeoutMs);
        pending.set(id, {
          resolve(value) { clearTimeout(timeout); resolveRequest(value); },
          reject(error) { clearTimeout(timeout); rejectRequest(error); },
        });
        process.stdin.write(`${JSON.stringify({ protocolVersion: PROTOCOL_VERSION, auth: token, id, method, params })}\n`);
      });
    },
    closeInput() { process.stdin.end(); },
  };
}

function sampleResidentMemory(pid) {
  let peakKiB = 0;
  const sample = () => {
    if (!pid || platform() === "win32") return;
    try {
      const value = Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" }).trim());
      if (Number.isFinite(value)) peakKiB = Math.max(peakKiB, value);
    } catch {
      // The process may have exited between timer scheduling and sampling.
    }
  };
  sample();
  const timer = setInterval(sample, 250);
  return {
    stop() {
      clearInterval(timer);
      sample();
      return peakKiB === 0 ? null : round(peakKiB / 1024);
    },
  };
}

function percentile(values, percentileValue) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * percentileValue) - 1)];
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function deviceSummary() {
  return {
    platform: platform(),
    release: release(),
    architecture: arch(),
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCores: cpus().length,
    memoryGibibytes: round(totalmem() / 1024 ** 3),
    freeMemoryGibibytesAtReport: round(freemem() / 1024 ** 3),
    node: process.version,
    go: commandVersion("go", ["version"]),
  };
}

function commandVersion(command, arguments_) {
  try {
    return execFileSync(command, arguments_, { encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

function gitRevision() {
  return commandVersion("git", ["rev-parse", "HEAD"]);
}

async function waitForExit(process) {
  if (process.exitCode !== null) return process.exitCode;
  return new Promise((resolveExit, rejectExit) => {
    process.once("error", rejectExit);
    process.once("exit", resolveExit);
  });
}

async function writeEvidence(path, report) {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}
