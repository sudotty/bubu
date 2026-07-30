import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const requiredReadmes = [
  "README.md",
  "apps/README.md",
  "apps/desktop/README.md",
  "services/README.md",
  "services/data-core/README.md",
  "services/ai-runtime/README.md",
  "packages/README.md",
  "packages/contracts/README.md",
  "docs/README.md",
  "docs/history/README.md",
  "docs/history/plans/README.md",
  "docs/strategy/README.md",
  "docs/release/README.md",
  "docs/product/conversation-workbench.md",
  "docs/product/design-qa.md",
  "scripts/README.md",
  ".github/README.md",
];

const failures = [];
for (const path of requiredReadmes) {
  if (!existsSync(resolve(path))) failures.push(`missing required documentation surface: ${path}`);
}

const root = readFileSync(resolve("README.md"), "utf8");
for (const marker of [
  "PRODUCT_MANIFEST.yaml",
  "docs/assets/product/01-datasets.png",
  "docs/assets/product/04-artifact.png",
  "docs/product/ui-ux-guidelines.md",
  "docs/product/conversation-workbench.md",
  "docs/strategy/README.md",
  "docs/history/README.md",
  "docs/release/README.md",
  "docs/release/release-runbook.md",
  "apps/desktop/README.md",
  "services/data-core/README.md",
  "services/ai-runtime/README.md",
]) {
  if (!root.includes(marker)) failures.push(`root README does not route readers to ${marker}`);
}

const desktop = readFileSync(resolve("apps/desktop/README.md"), "utf8");
for (const marker of ["Native packaging", "--skip-package", "docs/release/release-runbook.md"]) {
  if (!desktop.includes(marker)) failures.push(`desktop README is missing release guidance: ${marker}`);
}

const documentation = readFileSync(resolve("docs/README.md"), "utf8");
for (const marker of ["product/design-qa.md", "strategy/README.md", "history/README.md", "release/README.md", "release/release-runbook.md", "release/public-beta-readiness.md"]) {
  if (!documentation.includes(marker)) failures.push(`documentation index does not route readers to ${marker}`);
}

const release = readFileSync(resolve("docs/release/release-runbook.md"), "utf8");
for (const marker of ["BUBU_MAC_CERTIFICATE_P12_BASE64", "BUBU_AZURE_CLIENT_ID", "release:configure-environment", "npm run version:set", "draft GitHub Release", "Automatic in-app updates remain disabled"]) {
  if (!release.includes(marker)) failures.push(`release runbook is missing ${marker}`);
}

const github = readFileSync(resolve(".github/README.md"), "utf8");
for (const marker of ["package-smoke.yml", "release.yml", "dependabot.yml", "full commit SHA"]) {
  if (!github.includes(marker)) failures.push(`GitHub README is missing ${marker}`);
}

const markdownPaths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"], { encoding: "utf8" })
  .split("\n")
  .filter((path) => path && existsSync(resolve(path)));
const headingOptionalPaths = new Set([".github/pull_request_template.md"]);
for (const path of markdownPaths) {
  if (path.startsWith("docs/plans/")) failures.push(`${path} uses the retired active-plan location; move it under docs/history/plans`);
  if (/^docs\/product\/\d{4}-\d{2}-\d{2}-/u.test(path)) failures.push(`${path} mixes a dated strategy snapshot into current product guidance`);
  const source = readFileSync(resolve(path), "utf8");
  let inFence = false;
  let previousHeadingLevel = 0;
  let firstHeadingLevel = 0;
  let h1Count = 0;
  const proseLines = [];
  for (const [index, line] of source.split("\n").entries()) {
    if (/^\s*(?:```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    proseLines.push(line);
    const heading = line.match(/^(#{1,6})\s+\S/u);
    if (!heading) continue;
    const headingLevel = heading[1].length;
    if (firstHeadingLevel === 0) firstHeadingLevel = headingLevel;
    if (headingLevel === 1) h1Count += 1;
    if (previousHeadingLevel > 0 && headingLevel > previousHeadingLevel + 1) {
      failures.push(`${path}:${index + 1} skips from H${previousHeadingLevel} to H${headingLevel}`);
    }
    previousHeadingLevel = headingLevel;
  }
  if (!headingOptionalPaths.has(path) && (firstHeadingLevel !== 1 || h1Count !== 1)) {
    failures.push(`${path} must have exactly one H1 and use it as the first heading`);
  }
  for (const link of proseLines.join("\n").matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/gu)) {
    const rawTarget = link[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/u.test(rawTarget)) continue;
    const targetWithoutFragment = rawTarget.split("#", 1)[0];
    if (!targetWithoutFragment) continue;
    let target;
    try {
      target = decodeURIComponent(targetWithoutFragment);
    } catch {
      failures.push(`${path} contains an invalid encoded local link: ${rawTarget}`);
      continue;
    }
    const resolvedTarget = target.startsWith("/")
      ? resolve(target.slice(1))
      : resolve(dirname(path), target);
    if (!existsSync(resolvedTarget)) failures.push(`${path} links to a missing local target: ${rawTarget}`);
    else if (statSync(resolvedTarget).isDirectory()) failures.push(`${path} links to a directory instead of a document: ${rawTarget}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Documentation contract verified: ${requiredReadmes.length} routed surfaces and ${markdownPaths.length} Markdown files have aligned links and heading hierarchy.`);
