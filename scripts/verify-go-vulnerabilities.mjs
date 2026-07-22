import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const dataCore = resolve(import.meta.dirname, "../services/data-core");
const command = process.platform === "win32" ? "go.exe" : "go";
const result = spawnSync(
  command,
  ["run", "golang.org/x/vuln/cmd/govulncheck@v1.6.0", "./..."],
  { cwd: dataCore, stdio: "inherit" },
);

if (result.error) {
  console.error(`Unable to run govulncheck: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);
