import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { evaluateGoVulnerabilityReport } from "./go-vulnerability-policy.mjs";

const dataCore = resolve(import.meta.dirname, "../services/data-core");
const command = process.platform === "win32" ? "go.exe" : "go";
const result = spawnSync(
  command,
  ["run", "golang.org/x/vuln/cmd/govulncheck@v1.6.0", "-show", "verbose", "./..."],
  { cwd: dataCore, encoding: "utf8" },
);

if (result.error) {
  console.error(`Unable to run govulncheck: ${result.error.message}`);
  process.exit(1);
}
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);

const policy = evaluateGoVulnerabilityReport(result.stdout);
const failures = [];
if (policy.packageIds.length > 0) failures.push(`imported Go packages have advisories: ${policy.packageIds.join(", ")}`);
if (policy.moduleIds.length > 0) failures.push(`Go modules have advisories: ${policy.moduleIds.join(", ")}`);
if (failures.length > 0) {
  console.error(`Go vulnerability policy failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Go vulnerability policy passed with no reachable, imported-package, or module advisories.");
