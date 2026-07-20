import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  "docs/release/README.md",
  "docs/product/conversation-workbench.md",
  "scripts/README.md",
  "bubu-bi/README.md",
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
  "docs/release/README.md",
  "docs/release/release-runbook.md",
  "apps/desktop/README.md",
  "services/data-core/README.md",
  "services/ai-runtime/README.md",
]) {
  if (!root.includes(marker)) failures.push(`root README does not route readers to ${marker}`);
}

const legacy = readFileSync(resolve("bubu-bi/README.md"), "utf8");
if (!legacy.includes("Migration source only") || !legacy.includes("npm run dev")) {
  failures.push("legacy README must identify migration-only status and route active development to the root");
}

const desktop = readFileSync(resolve("apps/desktop/README.md"), "utf8");
for (const marker of ["Native packaging", "--skip-package", "docs/release/release-runbook.md"]) {
  if (!desktop.includes(marker)) failures.push(`desktop README is missing release guidance: ${marker}`);
}

const documentation = readFileSync(resolve("docs/README.md"), "utf8");
for (const marker of ["release/README.md", "release/release-runbook.md", "release/public-beta-readiness.md"]) {
  if (!documentation.includes(marker)) failures.push(`documentation index does not route readers to ${marker}`);
}

const release = readFileSync(resolve("docs/release/release-runbook.md"), "utf8");
for (const marker of ["BUBU_MAC_CERTIFICATE_P12_BASE64", "BUBU_AZURE_CLIENT_ID", "npm run version:set", "draft GitHub Release", "Automatic in-app updates remain disabled"]) {
  if (!release.includes(marker)) failures.push(`release runbook is missing ${marker}`);
}

const github = readFileSync(resolve(".github/README.md"), "utf8");
for (const marker of ["package-smoke.yml", "release.yml", "dependabot.yml", "full commit SHA"]) {
  if (!github.includes(marker)) failures.push(`GitHub README is missing ${marker}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Documentation contract verified: ${requiredReadmes.length} layered documentation surfaces and active/legacy/release routing are aligned.`);
