import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const required = [
  ".github/CODEOWNERS",
  ".github/README.md",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/workflows/verify.yml",
  ".github/workflows/package-smoke.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/preview-release.yml",
  ".github/workflows/release.yml",
  "CONTRIBUTING.md",
  "SECURITY.md",
];
const workflowPolicy = Object.freeze({
  ".github/workflows/verify.yml": {
    events: ["pull_request", "push", "workflow_dispatch"],
    jobs: { "pull-request-policy": undefined, "fast-contract": undefined },
    requiredText: ["Pull request policy", "Fast product contract", "npm run verify:fast", "ci-policy.mjs --pull-request-title"],
  },
  ".github/workflows/package-smoke.yml": {
    events: ["pull_request", "workflow_dispatch"],
    jobs: { changes: undefined, "hub-postgresql": undefined, "native-package": undefined, "package-contract": undefined },
    requiredText: ["Native package contract", "CHANGES_RESULT", "ci-policy.mjs --changed-files", "macos-15", "macos-15-intel", "windows-2025", "smoke-native-installer.mjs", "installer-smoke.json", "retention-days: 3"],
  },
  ".github/workflows/codeql.yml": {
    events: ["pull_request", "push", "workflow_dispatch"],
    jobs: { analyze: { contents: "read", "security-events": "write" }, "codeql-contract": undefined },
    requiredText: ["CodeQL contract", "javascript-typescript", "language: go", "build-mode: autobuild"],
  },
  ".github/workflows/preview-release.yml": {
    events: ["workflow_dispatch"],
    jobs: { "validate-preview-tag": undefined, package: undefined, publish: { contents: "write" } },
    requiredText: ["Existing preview-v<semver> tag", "Check out trusted workflow commit", "verify-release-ref.mjs", "--channel=preview", "sync-release-assets.mjs", "immutable unsigned prerelease"],
  },
  ".github/workflows/release.yml": {
    events: ["workflow_dispatch"],
    jobs: {
      prepare: undefined,
      macos: undefined,
      windows: { contents: "read", "id-token": "write" },
      "assemble-release": { contents: "read" },
      "attest-release": { contents: "read", "id-token": "write", attestations: "write" },
      "draft-release": { contents: "write" },
    },
    requiredText: ["environment: release", "Check out trusted workflow commit", "Check out verified release tag", "verify-release-ref.mjs", "--channel=stable", "resolve-previous-release.mjs", "--require-signature", "xcrun notarytool submit", "steps.release-settings.outputs.attestations", "needs.assemble-release.outputs.attestations", "sync-release-assets.mjs", "attest-build-provenance@", "cancel-in-progress: false"],
    forbiddenText: ['AuthKey_${{ secrets.', 'if [[ -n "${{ steps.', "if ('${{ steps.", 'security delete-keychain "${{', 'rm -f "${{'],
  },
});
const allowedActions = new Map([
  ["actions/checkout", { version: "v7.0.1", sha: "3d3c42e5aac5ba805825da76410c181273ba90b1" }],
  ["actions/setup-node", { version: "v7.0.0", sha: "820762786026740c76f36085b0efc47a31fe5020" }],
  ["actions/setup-go", { version: "v7.0.0", sha: "b7ad1dad31e06c5925ef5d2fc7ad053ef454303e" }],
  ["actions/upload-artifact", { version: "v7.0.1", sha: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a" }],
  ["actions/download-artifact", { version: "v8.0.1", sha: "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c" }],
  ["actions/attest-build-provenance", { version: "v4.1.1", sha: "0f67c3f4856b2e3261c31976d6725780e5e4c373" }],
  ["Azure/login", { version: "v3.0.0", sha: "532459ea530d8321f2fb9bb10d1e0bcf23869a43" }],
  ["Azure/artifact-signing-action", { version: "v2.0.0", sha: "c7ab2a863ab5f9a846ddb8265964877ef296ee82" }],
  ["github/codeql-action/init", { version: "v4.37.3", sha: "e4fba868fa4b1b91e1fdab776edc8cfbe6e9fb81" }],
  ["github/codeql-action/analyze", { version: "v4.37.3", sha: "e4fba868fa4b1b91e1fdab776edc8cfbe6e9fb81" }],
]);

function normalized(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function sameObject(left, right) {
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

const failures = required.filter((path) => !existsSync(resolve(path))).map((path) => `missing GitHub contract: ${path}`);
if (existsSync(resolve(".github/dependabot.yml"))) failures.push(".github/dependabot.yml must remain absent while automatic dependency branches are disabled");
const usedActions = new Set();

for (const [workflowPath, policy] of Object.entries(workflowPolicy)) {
  if (!existsSync(resolve(workflowPath))) continue;
  const source = readFileSync(resolve(workflowPath), "utf8");
  let workflow;
  try {
    workflow = parse(source);
  } catch (error) {
    failures.push(`${workflowPath} is not valid YAML: ${error.message}`);
    continue;
  }
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    failures.push(`${workflowPath} must contain one workflow object`);
    continue;
  }
  const events = Object.keys(workflow.on ?? {}).sort();
  if (JSON.stringify(events) !== JSON.stringify([...policy.events].sort())) failures.push(`${workflowPath} triggers must be exactly ${policy.events.join(", ")}`);
  if (!sameObject(workflow.permissions, { contents: "read" })) failures.push(`${workflowPath} must declare only top-level contents: read`);
  const jobs = workflow.jobs ?? {};
  if (JSON.stringify(Object.keys(jobs).sort()) !== JSON.stringify(Object.keys(policy.jobs).sort())) failures.push(`${workflowPath} job inventory changed without policy approval`);
  for (const [jobName, expectedPermissions] of Object.entries(policy.jobs)) {
    const job = jobs[jobName];
    if (!job) continue;
    if (expectedPermissions === undefined && job.permissions !== undefined) failures.push(`${workflowPath} ${jobName} must inherit read-only permissions`);
    if (expectedPermissions !== undefined && !sameObject(job.permissions, expectedPermissions)) failures.push(`${workflowPath} ${jobName} permissions exceed its exact allowlist`);
    for (const step of job.steps ?? []) {
      if (!step.uses) continue;
      if (typeof step.uses !== "string") {
        failures.push(`${workflowPath} ${jobName} has a non-string action reference`);
        continue;
      }
      const match = /^([^@\s]+)@([a-f0-9]{40})$/u.exec(step.uses);
      if (!match) {
        failures.push(`${workflowPath} action must use an allowlisted full SHA: ${step.uses}`);
        continue;
      }
      const [, action, sha] = match;
      const expected = allowedActions.get(action);
      if (!expected || expected.sha !== sha) failures.push(`${workflowPath} uses an unapproved action revision: ${step.uses}`);
      else usedActions.add(action);
    }
  }
  for (const text of policy.requiredText) if (!source.includes(text)) failures.push(`${workflowPath} is missing contract evidence: ${text}`);
  for (const text of policy.forbiddenText ?? []) if (source.includes(text)) failures.push(`${workflowPath} embeds a GitHub expression unsafely in shell source: ${text}`);
  for (const line of source.split("\n").filter((value) => /^\s*(?:-\s*)?uses:/u.test(value))) {
    const match = /^\s*(?:-\s*)?uses:\s*([^@\s]+)@([a-f0-9]{40})\s+#\s*(v\S+)\s*$/u.exec(line);
    if (!match) {
      failures.push(`${workflowPath} action line must retain its reviewed version comment: ${line.trim()}`);
      continue;
    }
    const expected = allowedActions.get(match[1]);
    if (expected && match[3] !== expected.version) failures.push(`${workflowPath} ${match[1]} version comment must be ${expected.version}`);
  }
}

for (const action of allowedActions.keys()) if (!usedActions.has(action)) failures.push(`GitHub workflows no longer exercise required action: ${action}`);
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("GitHub workflow contract verified semantically: exact triggers, jobs, permissions, checks, and immutable Actions agree.");
