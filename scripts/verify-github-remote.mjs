import { spawnSync } from "node:child_process";
import { allowedExternalActions, requiredGitHubChecks } from "./github-repository-policy.mjs";
import { releaseSecretNames, releaseVariableNames } from "./release-environment-config.mjs";

const failures = [];
const warnings = [];

function gh(args, { allowFailure = false } = {}) {
  const result = spawnSync("gh", args, { encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result;
}

function apiJson(endpoint) {
  return JSON.parse(gh(["api", endpoint]).stdout);
}

const repository = process.env.GITHUB_REPOSITORY?.trim()
  || gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).stdout.trim();
if (!/^[^/\s]+\/[^/\s]+$/u.test(repository)) throw new Error(`Unable to resolve GitHub repository: ${repository}`);

const repositoryMetadata = apiJson(`repos/${repository}`);
if (repositoryMetadata.default_branch !== "main") failures.push("the repository default branch must remain main");
if (repositoryMetadata.delete_branch_on_merge !== true) failures.push("merged pull-request branches must be deleted automatically");
if (repositoryMetadata.allow_squash_merge !== true || repositoryMetadata.allow_merge_commit !== false || repositoryMetadata.allow_rebase_merge !== false) {
  failures.push("squash must remain the only merge method");
}
if (repositoryMetadata.squash_merge_commit_title !== "PR_TITLE" || repositoryMetadata.squash_merge_commit_message !== "PR_BODY") {
  failures.push("squash commits must use the pull-request title and body");
}
const secretScanningEnabled = repositoryMetadata.security_and_analysis?.secret_scanning?.status === "enabled";
const pushProtectionEnabled = repositoryMetadata.security_and_analysis?.secret_scanning_push_protection?.status === "enabled";
if (!secretScanningEnabled || !pushProtectionEnabled) {
  const message = "GitHub Secret Scanning and Push Protection must remain enabled; local secret verification remains mandatory";
  if (repositoryMetadata.private === false) failures.push(message);
  else warnings.push(message);
}
const privateReporting = apiJson(`repos/${repository}/private-vulnerability-reporting`);
if (privateReporting.enabled !== true) failures.push("private vulnerability reporting must remain enabled");

const mainProtection = gh(["api", `repos/${repository}/branches/${repositoryMetadata.default_branch}/protection`], { allowFailure: true });
if (mainProtection.status !== 0) {
  failures.push("the default branch must be protected from deletion and force-pushes");
} else {
  const protection = JSON.parse(mainProtection.stdout);
  if (protection.enforce_admins?.enabled !== true) failures.push("default-branch protection must apply to administrators");
  if (protection.allow_force_pushes?.enabled !== false) failures.push("default branch must reject force-pushes");
  if (protection.allow_deletions?.enabled !== false) failures.push("default branch must reject deletion");
  if (protection.required_pull_request_reviews === null) failures.push("default branch changes must use a pull request");
  if (protection.required_linear_history?.enabled !== true) failures.push("default branch must keep linear history");
  if (protection.required_conversation_resolution?.enabled !== true) failures.push("pull-request conversations must be resolved before merge");
  const requiredChecks = protection.required_status_checks?.checks ?? [];
  if (protection.required_status_checks?.strict !== true) failures.push("required checks must run against the latest main commit");
  const actualChecks = requiredChecks.map(({ context, app_id: appId }) => `${context}:${appId}`).sort();
  const expectedChecks = requiredGitHubChecks.map((context) => `${context}:15368`).sort();
  if (JSON.stringify(actualChecks) !== JSON.stringify(expectedChecks)) failures.push(`default branch required checks must be exactly: ${expectedChecks.join(", ")}`);
}

const branches = apiJson(`repos/${repository}/branches?per_page=100`).map(({ name }) => name).sort();
if (JSON.stringify(branches) !== JSON.stringify(["main"])) failures.push(`remote branch inventory must contain only main; received: ${branches.join(", ")}`);

const actionPermissions = apiJson(`repos/${repository}/actions/permissions`);
if (actionPermissions.enabled !== true) failures.push("GitHub Actions is disabled");
if (actionPermissions.sha_pinning_required !== true) failures.push("repository settings do not require full-length Action SHAs");
if (actionPermissions.allowed_actions !== "selected") failures.push("GitHub Actions must use the selected-actions repository allowlist");
if (actionPermissions.allowed_actions === "selected") {
  const selectedActions = apiJson(`repos/${repository}/actions/permissions/selected-actions`);
  const patterns = [...(selectedActions.patterns_allowed ?? [])].sort();
  const expectedPatterns = [...allowedExternalActions].sort();
  if (selectedActions.github_owned_allowed !== true || selectedActions.verified_allowed !== false || JSON.stringify(patterns) !== JSON.stringify(expectedPatterns)) {
    failures.push("selected Actions must allow GitHub-owned Actions and only the two reviewed Azure signing Actions");
  }
}

const workflowPermissions = apiJson(`repos/${repository}/actions/permissions/workflow`);
if (workflowPermissions.default_workflow_permissions !== "read") failures.push("default workflow token permission must be read-only");
if (workflowPermissions.can_approve_pull_request_reviews !== false) failures.push("workflows must not approve pull requests");

const alerts = gh(["api", `repos/${repository}/vulnerability-alerts`, "--silent"], { allowFailure: true });
if (alerts.status !== 0) failures.push("Dependabot vulnerability alerts are disabled");
const automaticFixes = apiJson(`repos/${repository}/automated-security-fixes`);
if (automaticFixes.enabled !== false) failures.push("automatic Dependabot security-update branches are enabled");
const openAlerts = apiJson(`repos/${repository}/dependabot/alerts?state=open&per_page=100`);
if (openAlerts.length > 0) {
  failures.push(`${openAlerts.length} Dependabot vulnerability alert(s) remain open; patch and publish the affected manifests before treating remote GitHub security as healthy`);
}

const workflows = apiJson(`repos/${repository}/actions/workflows?per_page=100`).workflows ?? [];
for (const path of [
  ".github/workflows/verify.yml",
  ".github/workflows/package-smoke.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/preview-release.yml",
  ".github/workflows/release.yml",
]) {
  const workflow = workflows.find((candidate) => candidate.path === path);
  if (!workflow) failures.push(`remote workflow is missing: ${path}`);
  else if (workflow.state !== "active") failures.push(`remote workflow is not active: ${path}`);
}

const releaseEnvironment = gh(["api", `repos/${repository}/environments/release`], { allowFailure: true });
if (releaseEnvironment.status !== 0) {
  warnings.push("release environment protection is unavailable or unconfigured; signed releases remain externally blocked");
} else {
  const environment = JSON.parse(releaseEnvironment.stdout);
  if (environment.deployment_branch_policy?.custom_branch_policies !== true) failures.push("release environment must restrict deployments to the selected workflow ref");
  const reviewerRule = environment.protection_rules?.find(({ type }) => type === "required_reviewers");
  const ownerLogin = repository.split("/")[0];
  if (!reviewerRule || reviewerRule.reviewers?.length !== 1 || reviewerRule.reviewers[0]?.reviewer?.login !== ownerLogin) failures.push("release environment must require an explicit owner approval");
  const releasePolicies = apiJson(`repos/${repository}/environments/release/deployment-branch-policies`).branch_policies ?? [];
  if (releasePolicies.length !== 1 || releasePolicies[0]?.name !== "main" || releasePolicies[0]?.type !== "branch") {
    failures.push("release environment must accept only the protected main workflow ref");
  }

  const environmentSecrets = apiJson(`repos/${repository}/environments/release/secrets`).secrets ?? [];
  const environmentVariables = apiJson(`repos/${repository}/environments/release/variables`).variables ?? [];
  const secretNames = new Set(environmentSecrets.map(({ name }) => name));
  const variableNames = new Set(environmentVariables.map(({ name }) => name));
  const missingSecrets = releaseSecretNames.filter((name) => !secretNames.has(name));
  const missingVariables = releaseVariableNames.filter((name) => !variableNames.has(name));
  if (missingSecrets.length > 0) warnings.push(`release environment is missing secret names: ${missingSecrets.join(", ")}`);
  if (missingVariables.length > 0) warnings.push(`release environment is missing variable names: ${missingVariables.join(", ")}`);
  const attestation = environmentVariables.find(({ name }) => name === "BUBU_ENABLE_ARTIFACT_ATTESTATIONS")?.value;
  if (attestation !== undefined && !new Set(["true", "false"]).has(attestation)) failures.push("artifact-attestation variable must be true, false, or absent");
}

const tagRulesetSummary = apiJson(`repos/${repository}/rulesets`).find(({ name, target, enforcement }) => (
  name === "stable-release-tags" && target === "tag" && enforcement === "active"
));
if (!tagRulesetSummary) {
  failures.push("stable release tags must have an active ruleset");
} else {
  const tagRuleset = apiJson(`repos/${repository}/rulesets/${tagRulesetSummary.id}`);
  const includedRefs = tagRuleset.conditions?.ref_name?.include ?? [];
  const ruleTypes = new Set((tagRuleset.rules ?? []).map(({ type }) => type));
  if (includedRefs.length !== 1 || includedRefs[0] !== "refs/tags/v*" || !ruleTypes.has("deletion") || !ruleTypes.has("update") || (tagRuleset.bypass_actors ?? []).length !== 0) {
    failures.push("stable release tag ruleset must block v* updates and deletions");
  }
}

const previewRulesetSummary = apiJson(`repos/${repository}/rulesets`).find(({ name, target, enforcement }) => (
  name === "preview-release-tags" && target === "tag" && enforcement === "active"
));
if (!previewRulesetSummary) {
  failures.push("preview release tags must have an active immutable ruleset");
} else {
  const previewRuleset = apiJson(`repos/${repository}/rulesets/${previewRulesetSummary.id}`);
  const includedRefs = previewRuleset.conditions?.ref_name?.include ?? [];
  const ruleTypes = new Set((previewRuleset.rules ?? []).map(({ type }) => type));
  if (includedRefs.length !== 1 || includedRefs[0] !== "refs/tags/preview-v*" || !ruleTypes.has("deletion") || !ruleTypes.has("update") || (previewRuleset.bypass_actors ?? []).length !== 0) {
    failures.push("preview release tag ruleset must block preview-v* updates and deletions without bypass actors");
  }
}

if (failures.length > 0) {
  console.error(`Remote GitHub verification failed:\n\n- ${failures.join("\n- ")}`);
  for (const warning of warnings) console.warn(`Warning: ${warning}`);
  process.exit(1);
}
console.log(`Remote GitHub settings verified for ${repository}: exact CI gates, one main branch, linear pull requests, immutable stable and preview tags, private vulnerability reporting, selected pinned Actions, read-only tokens, vulnerability alerts, and active workflows agree.`);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
