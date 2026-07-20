import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const workspacePaths = ["apps/desktop", "packages/contracts", "services/ai-runtime"];

export function assertStableVersion(version) {
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(version)) {
    throw new Error(`Product version must be a stable SemVer value such as 0.2.0; received ${version}`);
  }
  return version;
}

export function updateManifest(manifest, version) {
  const next = structuredClone(manifest);
  next.version = version;
  if (next.dependencies?.["@bubu/contracts"]) next.dependencies["@bubu/contracts"] = version;
  return next;
}

export function updateLockfile(lockfile, version) {
  const next = structuredClone(lockfile);
  next.version = version;
  next.packages[""].version = version;
  for (const path of workspacePaths) next.packages[path] = updateManifest(next.packages[path], version);
  return next;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function main() {
  const version = assertStableVersion(argument("--version") ?? "");
  const manifestPaths = ["package.json", ...workspacePaths.map((path) => `${path}/package.json`)];
  for (const path of manifestPaths) writeJson(path, updateManifest(JSON.parse(readFileSync(path, "utf8")), version));
  writeJson("package-lock.json", updateLockfile(JSON.parse(readFileSync("package-lock.json", "utf8")), version));
  console.log(`Set every BuBu workspace manifest and lockfile entry to ${version}. Run npm run version:check and review the diff before tagging.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
