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
  "docs/product/conversation-workbench.md",
  "scripts/README.md",
  "bubu-bi/README.md",
];

const failures = [];
for (const path of requiredReadmes) {
  if (!existsSync(resolve(path))) failures.push(`missing required documentation surface: ${path}`);
}

const root = readFileSync(resolve("README.md"), "utf8");
for (const marker of [
  "PRODUCT_MANIFEST.yaml",
  "docs/assets/product/01-datasets.png",
  "docs/product/ui-ux-guidelines.md",
  "docs/product/conversation-workbench.md",
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

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Documentation contract verified: ${requiredReadmes.length} README surfaces and active/legacy routing are aligned.`);
