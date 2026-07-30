import { spawnSync } from "node:child_process";
import { allowedExternalActions, requiredGitHubChecks } from "./github-repository-policy.mjs";
import { repositoryFromRemoteUrl, validateRepositoryName } from "./release-environment-config.mjs";

function argument(name) {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function run(command, args, { input } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe", input });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function ghJson(method, endpoint, body) {
  return run("gh", ["api", "--method", method, endpoint, "--input", "-"], { input: JSON.stringify(body) });
}

const repository = validateRepositoryName(argument("--repository"));
const apply = process.argv.includes("--apply");
const unknown = process.argv.slice(2).filter((value) => value !== "--apply" && !value.startsWith("--repository="));
if (unknown.length > 0) throw new Error("Usage: configure-github-repository --repository=<owner/repository> [--apply]");
const origin = run("git", ["remote", "get-url", "origin"]).trim();
if (repositoryFromRemoteUrl(origin) !== repository) throw new Error(`${repository} does not match this worktree's GitHub origin`);

console.log(`GitHub governance plan for ${repository}: exact checks, selected immutable Actions, immutable preview tags, and explicit disabled attestations.`);
if (!apply) {
  console.log("Dry run complete; no remote changes were made.");
  process.exit(0);
}

ghJson("PUT", `repos/${repository}/actions/permissions`, {
  enabled: true,
  allowed_actions: "selected",
  sha_pinning_required: true,
});
ghJson("PUT", `repos/${repository}/actions/permissions/selected-actions`, {
  github_owned_allowed: true,
  verified_allowed: false,
  patterns_allowed: allowedExternalActions,
});
ghJson("PUT", `repos/${repository}/branches/main/protection`, {
  required_status_checks: {
    strict: true,
    checks: requiredGitHubChecks.map((context) => ({ context, app_id: 15368 })),
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: false,
    require_code_owner_reviews: false,
    require_last_push_approval: false,
    required_approving_review_count: 0,
  },
  restrictions: null,
  required_linear_history: true,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true,
  lock_branch: false,
  allow_fork_syncing: false,
});

const owner = JSON.parse(run("gh", ["api", `repos/${repository}`, "--jq", ".owner"]));
ghJson("PUT", `repos/${repository}/environments/release`, {
  wait_timer: 0,
  prevent_self_review: false,
  reviewers: [{ type: "User", id: owner.id }],
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
});
const deploymentPolicies = JSON.parse(run("gh", ["api", `repos/${repository}/environments/release/deployment-branch-policies`])).branch_policies ?? [];
for (const policy of deploymentPolicies) {
  run("gh", ["api", "--method", "DELETE", `repos/${repository}/environments/release/deployment-branch-policies/${policy.id}`]);
}
ghJson("POST", `repos/${repository}/environments/release/deployment-branch-policies`, { name: "main", type: "branch" });

const rulesets = JSON.parse(run("gh", ["api", `repos/${repository}/rulesets`]));
const preview = rulesets.find(({ name }) => name === "preview-release-tags");
const previewRule = {
  name: "preview-release-tags",
  target: "tag",
  enforcement: "active",
  bypass_actors: [],
  conditions: { ref_name: { exclude: [], include: ["refs/tags/preview-v*"] } },
  rules: [{ type: "deletion" }, { type: "update" }],
};
ghJson(preview ? "PUT" : "POST", preview ? `repos/${repository}/rulesets/${preview.id}` : `repos/${repository}/rulesets`, previewRule);
run("gh", ["variable", "set", "BUBU_ENABLE_ARTIFACT_ATTESTATIONS", "--body", "false", "--env", "release", "--repo", repository]);
console.log(`Applied GitHub governance contract to ${repository}.`);
