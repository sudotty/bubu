import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result;
}

export function staleReleaseAssets(remoteAssets, localNames) {
  const expected = new Set(localNames);
  return remoteAssets.filter((asset) => !expected.has(asset.name));
}

function main() {
  const tag = argument("--tag");
  const channel = argument("--channel");
  const directoryValue = argument("--directory");
  if (!tag || !directoryValue || !new Set(["stable", "preview"]).has(channel)) {
    throw new Error("Usage: sync-release-assets --tag=<tag> --channel=stable|preview --directory=<path>");
  }
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  if (!repository) throw new Error("GITHUB_REPOSITORY is required");
  const directory = resolve(directoryValue);
  if (!existsSync(directory)) throw new Error(`Release asset directory is missing: ${directory}`);
  const localNames = readdirSync(directory).sort();
  if (localNames.length === 0) throw new Error("Release asset directory is empty");
  const localPaths = localNames.map((name) => join(directory, name));
  if (localPaths.some((path) => !lstatSync(path).isFile())) throw new Error("Release asset directory must contain regular files only");

  const existing = run("gh", ["api", `repos/${repository}/releases/tags/${tag}`], { allowFailure: true });
  if (existing.status !== 0) {
    if (!existing.stderr.includes("HTTP 404")) throw new Error(`Unable to inspect existing release ${tag}: ${existing.stderr || existing.stdout}`);
    const args = ["release", "create", tag, ...localPaths, "--repo", repository, "--verify-tag", "--generate-notes"];
    if (channel === "stable") args.push("--draft", "--title", `BuBu ${tag}`);
    else args.push("--prerelease", "--title", `BuBu ${tag} (unsigned preview)`, "--notes", "This is an unsigned community preview. macOS Gatekeeper and Windows SmartScreen may warn. Do not treat this release as a signed stable build.");
    run("gh", args);
    console.log(`Created exact ${channel} release asset inventory for ${tag}`);
    return;
  }

  const release = JSON.parse(existing.stdout);
  if (channel === "preview") throw new Error(`Preview release ${tag} already exists and is immutable; create a new preview version`);
  if (release.draft !== true) throw new Error(`Refusing to modify published release ${tag}`);
  for (const asset of staleReleaseAssets(release.assets ?? [], localNames)) {
    run("gh", ["api", "--method", "DELETE", `repos/${repository}/releases/assets/${asset.id}`]);
  }
  run("gh", ["release", "upload", tag, ...localPaths, "--repo", repository, "--clobber"]);
  console.log(`Synchronized exact draft release asset inventory for ${tag}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
