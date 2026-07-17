import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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

const executable = resolve("apps", "desktop", "out", platformDirectory, ...executableParts);
if (!existsSync(executable)) {
  console.error(`Packaged desktop executable is missing: ${executable}`);
  process.exit(1);
}

const result = spawnSync(executable, ["--bubu-smoke-test"], {
  encoding: "utf8",
  timeout: 15_000,
});

if (result.error || result.status !== 0 || !result.stdout.includes("BUBU_PACKAGED_SMOKE_OK")) {
  console.error("Packaged desktop smoke failed.");
  if (result.error) console.error(result.error.message);
  if (result.stdout) console.error(result.stdout.trimEnd());
  if (result.stderr) console.error(result.stderr.trimEnd());
  process.exit(1);
}

console.log(`Packaged desktop smoke passed: ${executable}`);
