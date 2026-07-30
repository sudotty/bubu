import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { RELEASE_TARGETS, checksumLines, releaseAssetName, sha256 } from "./release-artifacts.mjs";
import { assertReleaseTagVersion, validateSmokeEvidence } from "./release-policy.mjs";

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
const channel = argument("--channel");
const input = resolve(argument("--input") ?? "release-input");
const output = resolve(argument("--output") ?? "release-assets");
const attestations = argument("--attestations") ?? "disabled";
if (!version || !tag || !new Set(["stable", "preview"]).has(channel) || !["enabled", "disabled"].includes(attestations)) throw new Error("Usage: finalize-release-assets --version=<semver> --channel=stable|preview [--tag=<git-tag>] [--input=<path>] [--output=<path>] [--attestations=enabled|disabled]");
assertReleaseTagVersion({ channel, tag, version });
if (channel === "preview" && attestations !== "disabled") throw new Error("Preview releases cannot claim attestations");

const inputFiles = files(input);
const pathsByName = new Map();
for (const path of inputFiles.filter((value) => basename(value) !== "target-manifest.json")) {
  const name = basename(path);
  if (pathsByName.has(name)) throw new Error(`Release inputs contain duplicate artifact name: ${name}`);
  pathsByName.set(name, path);
}
const targetManifests = inputFiles.filter((path) => basename(path) === "target-manifest.json").map((path) => JSON.parse(readFileSync(path, "utf8")));
const actualTargets = targetManifests.map((value) => value?.target?.id).sort();
const expectedTargets = RELEASE_TARGETS.map((value) => value.id).sort();
if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) throw new Error(`Release target set mismatch: expected ${expectedTargets.join(", ")}; received ${actualTargets.join(", ")}`);
if (targetManifests.some((value) => value.schemaVersion !== 1 || value.version !== version || value.channel !== channel)) throw new Error("A target manifest does not match the release identity");

const accountedNames = new Set();
function verifyRecord(record, context) {
  if (!record || typeof record.name !== "string" || !Number.isSafeInteger(record.bytes) || record.bytes < 0 || !/^[a-f0-9]{64}$/u.test(record.sha256 ?? "")) {
    throw new Error(`${context} has an invalid artifact record`);
  }
  if (accountedNames.has(record.name)) throw new Error(`Release manifests contain duplicate artifact: ${record.name}`);
  const path = pathsByName.get(record.name);
  if (!path || statSync(path).size !== record.bytes || sha256(path) !== record.sha256) throw new Error(`${context} does not match input bytes: ${record.name}`);
  accountedNames.add(record.name);
}
for (const manifest of targetManifests) {
  const expectedTarget = RELEASE_TARGETS.find((value) => value.id === manifest.target.id);
  if (!expectedTarget || manifest.target.platform !== expectedTarget.platform || manifest.target.arch !== expectedTarget.arch) throw new Error(`Target manifest identity is invalid: ${manifest.target.id}`);
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) throw new Error(`Target manifest has no artifacts: ${manifest.target.id}`);
  const expectedKinds = expectedTarget.platform === "darwin" ? ["dmg", "zip"] : ["setup", "nupkg", "releases"];
  const actualKinds = manifest.artifacts.map((artifact) => artifact.kind).sort();
  if (JSON.stringify(actualKinds) !== JSON.stringify([...expectedKinds].sort())) throw new Error(`Target artifact kinds are invalid: ${manifest.target.id}`);
  for (const artifact of manifest.artifacts) {
    if (artifact.name !== releaseAssetName(version, expectedTarget.platform, expectedTarget.arch, artifact.kind, artifact.name)) throw new Error(`Target artifact name is invalid: ${artifact.name}`);
  }
  if (manifest.smoke?.name !== releaseAssetName(version, expectedTarget.platform, expectedTarget.arch, "smoke")) throw new Error(`Target smoke name is invalid: ${manifest.target.id}`);
  for (const artifact of manifest.artifacts) verifyRecord(artifact, manifest.target.id);
  verifyRecord(manifest.smoke, `${manifest.target.id} smoke`);
  const evidence = manifest.smoke?.evidence;
  validateSmokeEvidence(evidence, { platform: expectedTarget.platform, arch: expectedTarget.arch, channel });
  const smokeFile = JSON.parse(readFileSync(pathsByName.get(manifest.smoke.name), "utf8"));
  if (JSON.stringify(smokeFile) !== JSON.stringify(evidence)) throw new Error(`Target smoke manifest does not match its bound report: ${manifest.target.id}`);
}

const metadataNames = channel === "stable" ? [
  `BuBu-${version}-npm-sbom.cdx.json`,
  `BuBu-${version}-go-sbom.cdx.json`,
] : [];
for (const name of metadataNames) {
  const path = pathsByName.get(name);
  if (!path || statSync(path).size === 0) throw new Error(`Required release metadata is missing or empty: ${name}`);
  accountedNames.add(name);
}
const unaccounted = [...pathsByName.keys()].filter((name) => !accountedNames.has(name));
if (unaccounted.length > 0) throw new Error(`Release inputs contain unaccounted files: ${unaccounted.join(", ")}`);

if (existsSync(output) && readdirSync(output).length > 0) throw new Error(`Release output must be empty: ${output}`);
mkdirSync(output, { recursive: true });
const distributableInputs = inputFiles.filter((path) => basename(path) !== "target-manifest.json");
const names = distributableInputs.map((path) => basename(path));
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
      channel,
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
