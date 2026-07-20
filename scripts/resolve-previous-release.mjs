import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { releaseAssetName, resolveReleaseTarget } from "./release-artifacts.mjs";

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

const releases = JSON.parse(run("gh", ["api", `repos/${repository}/releases?per_page=100`]));
const previous = releases
  .filter((release) => !release.draft && !release.prerelease && release.tag_name !== currentTag)
  .sort((left, right) => String(right.published_at).localeCompare(String(left.published_at)))[0];
let artifact = "";
if (previous) {
  const previousVersion = previous.tag_name.startsWith("v") ? previous.tag_name.slice(1) : previous.tag_name;
  const expectedName = releaseAssetName(previousVersion, platform, arch, platform === "darwin" ? "dmg" : "setup");
  if (!previous.assets.some((asset) => asset.name === expectedName)) throw new Error(`Previous stable release ${previous.tag_name} is missing ${expectedName}; upgrade validation cannot be skipped`);
  mkdirSync(output, { recursive: true });
  run("gh", ["release", "download", previous.tag_name, "--repo", repository, "--pattern", expectedName, "--dir", output]);
  artifact = join(output, expectedName);
  if (!existsSync(artifact)) throw new Error(`Downloaded previous installer is missing: ${artifact}`);
  console.log(`Resolved previous ${platform}-${arch} installer from ${previous.tag_name}`);
} else {
  console.log("No previous stable release exists; this release uses the documented first-release upgrade exception");
}
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `artifact=${artifact}\n`);
}
