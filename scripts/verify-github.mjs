import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  ".github/CODEOWNERS",
  ".github/README.md",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/workflows/verify.yml",
  ".github/workflows/package-smoke.yml",
  ".github/workflows/preview-release.yml",
  ".github/workflows/release.yml",
  "CONTRIBUTING.md",
  "SECURITY.md",
];
const workflowPaths = [
  ".github/workflows/verify.yml",
  ".github/workflows/package-smoke.yml",
  ".github/workflows/preview-release.yml",
  ".github/workflows/release.yml",
];
const allowedActions = new Map([
  ["actions/checkout", { version: "v7.0.1", sha: "3d3c42e5aac5ba805825da76410c181273ba90b1" }],
  ["actions/setup-node", { version: "v7.0.0", sha: "820762786026740c76f36085b0efc47a31fe5020" }],
  ["actions/setup-go", { version: "v7.0.0", sha: "b7ad1dad31e06c5925ef5d2fc7ad053ef454303e" }],
  ["actions/upload-artifact", { version: "v7.0.1", sha: "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a" }],
  ["actions/download-artifact", { version: "v8.0.1", sha: "3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c" }],
  ["actions/attest-build-provenance", { version: "v4.1.1", sha: "0f67c3f4856b2e3261c31976d6725780e5e4c373" }],
  ["Azure/login", { version: "v3.0.0", sha: "532459ea530d8321f2fb9bb10d1e0bcf23869a43" }],
  ["Azure/artifact-signing-action", { version: "v2.0.0", sha: "c7ab2a863ab5f9a846ddb8265964877ef296ee82" }],
]);

const failures = required
  .filter((path) => !existsSync(resolve(path)))
  .map((path) => `missing GitHub contract: ${path}`);
if (existsSync(resolve(".github/dependabot.yml"))) {
  failures.push(".github/dependabot.yml must remain absent while automatic dependency branches are disabled");
}

const usedActions = new Set();
for (const workflowPath of workflowPaths) {
  if (!existsSync(resolve(workflowPath))) continue;
  const workflow = readFileSync(resolve(workflowPath), "utf8");
  if (workflow.includes("pull_request_target:")) failures.push(`${workflowPath} uses forbidden pull_request_target`);
  if (!/^permissions:\n  contents: read$/mu.test(workflow)) failures.push(`${workflowPath} must declare top-level read-only contents permission`);

  for (const line of workflow.split("\n").filter((value) => /^\s*(?:-\s*)?uses:/u.test(value))) {
    const parsed = line.match(/^\s*(?:-\s*)?uses:\s*([^@\s]+)@([a-f0-9]{40})\s+#\s*(v\S+)\s*$/u);
    if (!parsed) {
      failures.push(`${workflowPath} action must use an allowlisted full SHA and version comment: ${line.trim()}`);
      continue;
    }
    const [, action, sha, version] = parsed;
    const expected = allowedActions.get(action);
    if (!expected) {
      failures.push(`${workflowPath} uses unapproved action: ${action}`);
      continue;
    }
    usedActions.add(action);
    if (sha !== expected.sha || version !== expected.version) {
      failures.push(`${workflowPath} ${action} must use ${expected.sha} # ${expected.version}`);
    }
  }
}
for (const action of allowedActions.keys()) {
  if (!usedActions.has(action)) failures.push(`GitHub workflows no longer exercise required action: ${action}`);
}

if (existsSync(resolve(".github/workflows/package-smoke.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/package-smoke.yml"), "utf8");
  for (const value of ["paths:", "apps/desktop/**", "macos-15", "macos-15-intel", "windows-2025", "smoke-native-installer.mjs", "retention-days: 7"]) {
    if (!workflow.includes(value)) failures.push(`native package workflow missing ${value}`);
  }
}
if (existsSync(resolve(".github/workflows/verify.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/verify.yml"), "utf8");
  for (const value of ["fast-contract:", "ubuntu-24.04", "npm run verify:fast"]) {
    if (!workflow.includes(value)) failures.push(`verification workflow missing ${value}`);
  }
}
if (existsSync(resolve(".github/workflows/preview-release.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/preview-release.yml"), "utf8");
  for (const value of ["preview-v*.*.*", "Unsigned ${{ matrix.target }}", "macos-15", "macos-15-intel", "windows-2025", "smoke-native-installer.mjs", "finalize-release-assets.mjs", "--tag=\"$BUBU_PREVIEW_TAG\"", "gh release create", "--prerelease", "contents: write"]) {
    if (!workflow.includes(value)) failures.push(`preview release workflow missing ${value}`);
  }
}
if (existsSync(resolve(".github/workflows/release.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/release.yml"), "utf8");
  for (const value of [
    "environment: release",
    "refs/tags/${{ env.BUBU_RELEASE_TAG }}",
    "git/tags/$tag_sha",
    ".verification.verified == true",
    "Azure/artifact-signing-action@",
    "xcrun notarytool submit",
    "--require-signature",
    "PREVIOUS_ARTIFACT:",
    "SIGNING_KEYCHAIN:",
    "SIGNING_API_KEY:",
    "npm sbom",
    "finalize-release-assets.mjs",
    "attest-build-provenance@",
    "--draft",
    "cancel-in-progress: false",
  ]) {
    if (!workflow.includes(value)) failures.push(`signed release workflow missing ${value}`);
  }
  for (const unsafe of [
    'AuthKey_${{ secrets.',
    'if [[ -n "${{ steps.',
    "if ('${{ steps.",
    'security delete-keychain "${{',
    'rm -f "${{',
  ]) {
    if (workflow.includes(unsafe)) failures.push(`signed release workflow embeds an expression in shell source: ${unsafe}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("GitHub contract verified: manual dependency updates, least-privilege workflows, signed release tags, and allowlisted immutable Actions agree.");
