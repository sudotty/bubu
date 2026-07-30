import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { releaseAssetName, resolveReleaseTarget, sha256 } from "./release-artifacts.mjs";
import { verifyNativeInstallerSignature } from "./native-signature-verifier.mjs";
import { parseChecksumInventory, selectPreviousStableRelease } from "./release-policy.mjs";

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

const currentTag = argument("--current-tag");
const platform = argument("--platform");
const arch = argument("--arch");
const output = resolve(argument("--output") ?? "previous-release");
if (!currentTag || !platform || !arch) throw new Error("Usage: resolve-previous-release --current-tag=<tag> --platform=<platform> --arch=<arch> [--output=<path>]");
resolveReleaseTarget(platform, arch);
const repository = process.env.GITHUB_REPOSITORY?.trim();
if (!repository) throw new Error("GITHUB_REPOSITORY is required to resolve the previous release");

const releasePages = JSON.parse(run("gh", ["api", "--paginate", "--slurp", `repos/${repository}/releases?per_page=100`]));
const releases = releasePages.flat();
const previous = selectPreviousStableRelease(releases, currentTag);
let artifact = "";
let previousTag = "";
if (previous) {
  const previousVersion = previous.tag_name.startsWith("v") ? previous.tag_name.slice(1) : previous.tag_name;
  const expectedName = releaseAssetName(previousVersion, platform, arch, platform === "darwin" ? "dmg" : "setup");
  const checksumName = `BuBu-${previousVersion}-SHA256SUMS.txt`;
  const manifestName = `BuBu-${previousVersion}-release-manifest.json`;
  for (const name of [expectedName, checksumName, manifestName]) {
    if (!previous.assets.some((asset) => asset.name === name)) throw new Error(`Previous stable release ${previous.tag_name} is missing ${name}; upgrade validation cannot be trusted`);
  }
  mkdirSync(output, { recursive: true });
  for (const name of [expectedName, checksumName, manifestName]) {
    run("gh", ["release", "download", previous.tag_name, "--repo", repository, "--pattern", name, "--dir", output]);
  }
  artifact = join(output, expectedName);
  if (!existsSync(artifact)) throw new Error(`Downloaded previous installer is missing: ${artifact}`);
  const manifest = JSON.parse(readFileSync(join(output, manifestName), "utf8"));
  const manifestArtifact = Array.isArray(manifest.artifacts) ? manifest.artifacts.find((value) => value?.name === expectedName) : undefined;
  const checksums = parseChecksumInventory(readFileSync(join(output, checksumName), "utf8"));
  const digest = sha256(artifact);
  if (manifest.schemaVersion !== 1 || manifest.channel !== "stable" || manifest.version !== previousVersion || manifest.tag !== previous.tag_name) throw new Error(`Previous release manifest identity is invalid for ${previous.tag_name}`);
  if (manifestArtifact?.sha256 !== digest || manifestArtifact?.bytes !== statSync(artifact).size || checksums.get(expectedName) !== digest) throw new Error(`Previous installer digest does not match its release evidence: ${expectedName}`);
  verifyNativeInstallerSignature(platform, artifact);
  previousTag = previous.tag_name;
  console.log(`Resolved and signature-verified previous ${platform}-${arch} installer from ${previous.tag_name}`);
} else {
  console.log("No previous stable release exists; this release uses the documented first-release upgrade exception");
}
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `artifact=${artifact}\nprevious_tag=${previousTag}\nhas_previous=${previous ? "true" : "false"}\n`);
}
