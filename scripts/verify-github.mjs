import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/workflows/verify.yml",
  "CONTRIBUTING.md",
  "SECURITY.md",
];
const failures = required.filter((path) => !existsSync(resolve(path))).map((path) => `missing GitHub contract: ${path}`);
if (existsSync(resolve(".github/workflows/verify.yml"))) {
  const workflow = readFileSync(resolve(".github/workflows/verify.yml"), "utf8");
  if (workflow.includes("pull_request_target:")) failures.push("pull_request_target is forbidden");
  if (!/^permissions:\n  contents: read$/mu.test(workflow)) failures.push("workflow must declare top-level read-only contents permission");
  for (const line of workflow.split("\n").filter((value) => /^\s*-?\s*uses:/u.test(value))) {
    if (!/@[a-f0-9]{40}(?:\s+#.*)?$/u.test(line)) failures.push(`action is not pinned to a full commit SHA: ${line.trim()}`);
  }
}
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("GitHub contract verified: community files exist and CI uses least privilege with immutable action pins.");
