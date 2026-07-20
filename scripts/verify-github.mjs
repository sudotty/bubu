import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  ".github/CODEOWNERS",
  ".github/README.md",
  ".github/dependabot.yml",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/workflows/verify.yml",
  ".github/workflows/package-smoke.yml",
  ".github/workflows/release.yml",
  "CONTRIBUTING.md",
  "SECURITY.md",
];
const failures = required.filter((path) => !existsSync(resolve(path))).map((path) => `missing GitHub contract: ${path}`);
for (const workflowPath of [".github/workflows/verify.yml", ".github/workflows/package-smoke.yml", ".github/workflows/release.yml"]) {
  if (!existsSync(resolve(workflowPath))) continue;
  const workflow = readFileSync(resolve(workflowPath), "utf8");
  if (workflow.includes("pull_request_target:")) failures.push("pull_request_target is forbidden");
  if (!/^permissions:\n  contents: read$/mu.test(workflow)) failures.push(`${workflowPath} must declare top-level read-only contents permission`);
  for (const line of workflow.split("\n").filter((value) => /^\s*-?\s*uses:/u.test(value))) {
    if (!/@[a-f0-9]{40}(?:\s+#.*)?$/u.test(line)) failures.push(`${workflowPath} action is not pinned to a full commit SHA: ${line.trim()}`);
  }
}
if (existsSync(resolve(".github/workflows/package-smoke.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/package-smoke.yml"), "utf8");
  for (const value of ["macos-15", "macos-15-intel", "windows-2025", "smoke-native-installer.mjs", "retention-days: 7"]) {
    if (!workflow.includes(value)) failures.push(`native package workflow missing ${value}`);
  }
}
if (existsSync(resolve(".github/workflows/release.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/release.yml"), "utf8");
  for (const value of ["environment: release", "Azure/artifact-signing-action@", "xcrun notarytool submit", "--require-signature", "npm sbom", "finalize-release-assets.mjs", "attest-build-provenance@", "--draft", "cancel-in-progress: false"]) {
    if (!workflow.includes(value)) failures.push(`signed release workflow missing ${value}`);
  }
}
if (existsSync(resolve(".github/dependabot.yml"))) {
  const dependabot = readFileSync(resolve(".github/dependabot.yml"), "utf8");
  for (const value of ["package-ecosystem: npm", "package-ecosystem: gomod", "package-ecosystem: github-actions", "electron-toolchain:", "timezone: Asia/Shanghai"]) {
    if (!dependabot.includes(value)) failures.push(`Dependabot contract missing ${value}`);
  }
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("GitHub contract verified: community files exist and CI/package/release workflows use least privilege with immutable action pins.");
