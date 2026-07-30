import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { assertReleaseTagVersion, successfulRequiredChecks } from "./release-policy.mjs";

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

const tag = argument("--tag");
const channel = argument("--channel");
if (!tag || !new Set(["stable", "preview"]).has(channel)) {
  throw new Error("Usage: verify-release-ref --tag=<tag> --channel=stable|preview");
}
const repository = process.env.GITHUB_REPOSITORY?.trim();
if (!repository) throw new Error("GITHUB_REPOSITORY is required");

const reference = JSON.parse(run("gh", ["api", `repos/${repository}/git/ref/tags/${tag}`]));
if (reference.object?.type !== "tag") throw new Error(`${tag} must be an annotated tag`);
const tagObject = JSON.parse(run("gh", ["api", `repos/${repository}/git/tags/${reference.object.sha}`]));
if (tagObject.object?.type !== "commit") throw new Error(`${tag} must point directly to a commit`);
if (channel === "stable" && tagObject.verification?.verified !== true) throw new Error(`${tag} must have a GitHub-verified signature`);

const commit = tagObject.object.sha;
if (run("git", ["rev-parse", "HEAD"]) !== commit) throw new Error(`Checked-out commit does not match ${tag}`);
run("git", ["fetch", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"]);
run("git", ["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"]);

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
assertReleaseTagVersion({ channel, tag, version });
const checks = JSON.parse(run("gh", ["api", `repos/${repository}/commits/${commit}/check-runs?filter=latest&per_page=100`])).check_runs;
const { missing } = successfulRequiredChecks(checks);
if (missing.length > 0) throw new Error(`${tag} commit is missing successful required checks: ${missing.join(", ")}`);
console.log(`Verified ${channel} tag ${tag}: exact version, annotated tag, protected-main ancestry, and required checks agree.`);
