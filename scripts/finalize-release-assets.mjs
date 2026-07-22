import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { RELEASE_TARGETS, checksumLines, sha256 } from "./release-artifacts.mjs";

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
const tag = argument("--tag") ?? `v${version}`;
const input = resolve(argument("--input") ?? "release-input");
const output = resolve(argument("--output") ?? "release-assets");
const attestations = argument("--attestations") ?? "disabled";
if (!version || !tag || !["enabled", "disabled"].includes(attestations)) throw new Error("Usage: finalize-release-assets --version=<semver> [--tag=<git-tag>] [--input=<path>] [--output=<path>] [--attestations=enabled|disabled]");

const inputFiles = files(input);
const targetManifests = inputFiles.filter((path) => basename(path) === "target-manifest.json").map((path) => JSON.parse(readFileSync(path, "utf8")));
const actualTargets = targetManifests.map((value) => value.target.id).sort();
const expectedTargets = RELEASE_TARGETS.map((value) => value.id).sort();
if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) throw new Error(`Release target set mismatch: expected ${expectedTargets.join(", ")}; received ${actualTargets.join(", ")}`);
if (targetManifests.some((value) => value.version !== version)) throw new Error("A target manifest does not match the release version");

mkdirSync(output, { recursive: true });
const distributableInputs = inputFiles.filter((path) => basename(path) !== "target-manifest.json");
const names = distributableInputs.map((path) => basename(path));
if (new Set(names).size !== names.length) throw new Error("Release inputs contain duplicate artifact names");
for (const path of distributableInputs) copyFileSync(path, join(output, basename(path)));

const artifacts = distributableInputs.map((path) => {
  const destination = join(output, basename(path));
  return { name: basename(path), bytes: statSync(destination).size, sha256: sha256(destination) };
}).sort((left, right) => left.name.localeCompare(right.name));
const checksumName = `BuBu-${version}-SHA256SUMS.txt`;
writeFileSync(join(output, checksumName), `${checksumLines(artifacts)}\n`);
const manifestName = `BuBu-${version}-release-manifest.json`;
writeFileSync(join(output, manifestName), `${JSON.stringify({
  schemaVersion: 1,
  product: "BuBu",
  version,
  tag,
  targets: targetManifests.map((value) => ({ target: value.target, smoke: value.smoke })).sort((left, right) => left.target.id.localeCompare(right.target.id)),
  artifacts,
  attestations,
}, null, 2)}\n`);

for (const artifact of artifacts) {
  if (sha256(join(output, artifact.name)) !== artifact.sha256) throw new Error(`Release artifact changed while finalizing: ${artifact.name}`);
}
console.log(`Finalized ${artifacts.length} release assets for v${version}`);
