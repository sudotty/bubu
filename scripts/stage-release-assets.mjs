import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { classifyMakeArtifact, releaseAssetName, resolveReleaseTarget, sha256 } from "./release-artifacts.mjs";

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function files(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const version = argument("--version");
const platform = argument("--platform");
const arch = argument("--arch");
const output = resolve(argument("--output") ?? "release-stage");
const makeRoot = resolve(argument("--make-root") ?? "apps/desktop/out/make");
const smokeReportValue = argument("--smoke-report");
if (!version || !platform || !arch || !smokeReportValue) throw new Error("Usage: stage-release-assets --version=<semver> --platform=<platform> --arch=<arch> --smoke-report=<path> [--make-root=<path>] [--output=<path>]");
const smokeReport = resolve(smokeReportValue);
const target = resolveReleaseTarget(platform, arch);
if (!existsSync(smokeReport)) throw new Error(`Installer smoke report is missing: ${smokeReport}`);

const matches = files(makeRoot)
  .map((path) => ({ path, kind: classifyMakeArtifact(platform, path) }))
  .filter((value) => value.kind);
const requiredKinds = platform === "darwin" ? ["dmg", "zip"] : ["setup", "nupkg", "releases"];
for (const kind of requiredKinds) {
  const count = matches.filter((value) => value.kind === kind).length;
  if (count !== 1) throw new Error(`Expected exactly one ${kind} artifact for ${target.id}, found ${count}`);
}

mkdirSync(output, { recursive: true });
const staged = matches.map(({ path, kind }) => {
  const name = releaseAssetName(version, platform, arch, kind, basename(path));
  const destination = join(output, name);
  copyFileSync(path, destination);
  return { kind, name, bytes: statSync(destination).size, sha256: sha256(destination) };
});
const smokeName = releaseAssetName(version, platform, arch, "smoke");
const smokeDestination = join(output, smokeName);
copyFileSync(smokeReport, smokeDestination);
const smoke = JSON.parse(readFileSync(smokeDestination, "utf8"));
if (smoke.platform !== platform || smoke.arch !== arch) throw new Error(`Smoke report target ${smoke.platform}-${smoke.arch} does not match ${platform}-${arch}`);

writeFileSync(join(output, "target-manifest.json"), `${JSON.stringify({
  schemaVersion: 1,
  version,
  target,
  artifacts: staged,
  smoke: { name: smokeName, passed: smoke.passed, upgrade: smoke.upgrade, signature: smoke.signature },
}, null, 2)}\n`);
console.log(`Staged ${target.id} release assets in ${output}`);
