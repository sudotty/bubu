import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { classifyMakeArtifact, releaseAssetName, resolveReleaseTarget, sha256 } from "./release-artifacts.mjs";
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
const platform = argument("--platform");
const arch = argument("--arch");
const channel = argument("--channel");
const output = resolve(argument("--output") ?? "release-stage");
const makeRoot = resolve(argument("--make-root") ?? "apps/desktop/out/make");
const smokeReportValue = argument("--smoke-report");
if (!version || !platform || !arch || !smokeReportValue || !new Set(["stable", "preview"]).has(channel)) throw new Error("Usage: stage-release-assets --version=<semver> --channel=stable|preview --platform=<platform> --arch=<arch> --smoke-report=<path> [--make-root=<path>] [--output=<path>]");
assertReleaseTagVersion({ channel, tag: channel === "stable" ? `v${version}` : `preview-v${version}`, version });
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

if (existsSync(output) && readdirSync(output).length > 0) throw new Error(`Release stage output must be empty: ${output}`);
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
validateSmokeEvidence(smoke, { platform, arch, channel });
const installerKind = platform === "darwin" ? "dmg" : "setup";
const installerSource = matches.find((value) => value.kind === installerKind)?.path;
if (!installerSource || smoke.artifact !== basename(installerSource)) throw new Error("Smoke report artifact does not match the staged installer");
const smokeRecord = {
  name: smokeName,
  bytes: statSync(smokeDestination).size,
  sha256: sha256(smokeDestination),
  evidence: smoke,
};

writeFileSync(join(output, "target-manifest.json"), `${JSON.stringify({
  schemaVersion: 1,
  channel,
  version,
  target,
  artifacts: staged,
  smoke: smokeRecord,
}, null, 2)}\n`);
console.log(`Staged ${target.id} release assets in ${output}`);
