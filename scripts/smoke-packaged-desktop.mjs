import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { packagedSmokeTimeoutMs } from "./native-installer-policy.mjs";

const platformDirectory = `BuBu-${process.platform}-${process.arch}`;
const executableByPlatform = {
  darwin: ["BuBu.app", "Contents", "MacOS", "bubu"],
  linux: ["bubu"],
  win32: ["bubu.exe"],
};
const executableParts = executableByPlatform[process.platform];
if (!executableParts) {
  console.error(`Packaged smoke is not defined for ${process.platform}`);
  process.exit(1);
}

const executableArgument = process.argv.find((argument) => argument.startsWith("--executable="));
const executable = executableArgument
  ? resolve(executableArgument.slice("--executable=".length))
  : resolve("apps", "desktop", "out", platformDirectory, ...executableParts);
if (!existsSync(executable)) {
  console.error(`Packaged desktop executable is missing: ${executable}`);
  process.exit(1);
}

const smokeRoot = mkdtempSync(resolve(tmpdir(), "bubu-desktop-smoke-"));
const sourcePath = resolve(smokeRoot, "synthetic-sales.csv");
const secondSourcePath = resolve(smokeRoot, "synthetic-targets.csv");
const dataDirectory = resolve(smokeRoot, "data");
const screenshotArgument = process.argv.find((argument) => argument.startsWith("--screenshots="));
const screenshotDirectory = screenshotArgument
  ? resolve(screenshotArgument.slice("--screenshots=".length))
  : undefined;
writeFileSync(
  sourcePath,
  "Order ID,Region,Amount,Date\n001,North,128.50,2026-07-15\n002,South,256.00,2026-07-16\n003,North,64.25,2026-07-17\n",
  { mode: 0o600 },
);
writeFileSync(
  secondSourcePath,
  "Order ID,Region,Amount,Date\nT-001,North,300.00,2026-07-15\nT-002,South,400.00,2026-07-16\nT-003,West,250.00,2026-07-17\n",
  { mode: 0o600 },
);

const timeoutMs = packagedSmokeTimeoutMs(process.platform);
const result = await new Promise((resolveResult) => {
  const child = spawn(executable, ["--bubu-smoke-test"], {
  env: {
    ...process.env,
    BUBU_SMOKE_DATA_DIR: dataDirectory,
    BUBU_SMOKE_SOURCE: sourcePath,
    BUBU_SMOKE_SECOND_SOURCE: secondSourcePath,
    ...(screenshotDirectory ? { BUBU_SMOKE_SCREENSHOT_DIR: screenshotDirectory } : {}),
  },
  });
  let stdout = "";
  let stderr = "";
  let timeout;
  let forceKill;
  let timedOut = false;
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.once("error", (error) => {
    clearTimeout(timeout);
    clearTimeout(forceKill);
    resolveResult({ error, status: null, stdout, stderr });
  });
  child.once("close", (status) => {
    clearTimeout(timeout);
    clearTimeout(forceKill);
    resolveResult({
      ...(timedOut ? { error: new Error(`Packaged desktop exceeded ${timeoutMs}ms`) } : {}),
      status,
      stdout,
      stderr,
    });
  });
  timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
    forceKill = setTimeout(() => child.kill("SIGKILL"), 1_000);
  }, timeoutMs);
});
rmSync(smokeRoot, { recursive: true, force: true });

if (
  result.error ||
  result.status !== 0 ||
  !result.stdout.includes("BUBU_PACKAGED_SMOKE_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_IMPORT_UI_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_BACKUP_RESTORE_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_RECURRING_CLEAN_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_MERGE_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_RECONCILIATION_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_FILE_ARRIVAL_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_PROFESSIONAL_REPORT_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_EXPLICIT_ROWS_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_CONVERSATION_RETENTION_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_CONFIGURATION_BACKUP_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_ACCESSIBILITY_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_ONBOARDING_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_AGENT_DEFINITION_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_REPORT_COMPOSITION_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_VISUALIZATION_PREFERENCE_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_LOCAL_RAG_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_MCP_MODEL_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_REMOTE_MCP_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_EXTERNAL_DELIVERY_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_HUB_SYNC_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_HUB_APPLICATION_ENTRY_OK") ||
  !result.stdout.includes("BUBU_PACKAGED_WORKFLOW_APPROVAL_OK")
) {
  console.error("Packaged desktop smoke failed.");
  if (result.error) console.error(result.error.message);
  if (result.stdout) console.error(result.stdout.trimEnd());
  if (result.stderr) console.error(result.stderr.trimEnd());
  process.exit(1);
}

console.log(`Packaged desktop smoke passed: ${executable}`);
const workflowGeometry = result.stdout.split("\n").find((line) => line.startsWith("BUBU_PACKAGED_WORKFLOW_GEOMETRY"));
if (workflowGeometry) console.log(workflowGeometry);
if (screenshotDirectory) console.log(`Product screenshots written to: ${screenshotDirectory}`);
