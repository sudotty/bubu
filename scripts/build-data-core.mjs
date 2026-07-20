import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { dataCoreBinaryPath, goTarget } from "./platform-paths.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const targetPlatform = argument("--platform", process.platform);
const targetArch = argument("--arch", process.arch);
if (!targetPlatform || !targetArch) throw new Error("--platform and --arch require values");
const { goos, goarch } = goTarget(targetPlatform, targetArch);
const output = dataCoreBinaryPath(targetPlatform);
mkdirSync(dirname(output), { recursive: true });
const result = spawnSync("go", ["build", "-trimpath", "-o", output, "./cmd/bubu-data-core"], {
  cwd: new URL("../services/data-core", import.meta.url),
  env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" },
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Data core built for ${targetPlatform}-${targetArch}: ${output}`);
