import { readFileSync } from "node:fs";
import { loadProductManifest } from "./product-manifest.mjs";

const root = new URL("..", import.meta.url);
const manifest = loadProductManifest(root);
const guide = readFileSync(new URL("../docs/product/capability-status.md", import.meta.url), "utf8");
const documented = new Map([...guide.matchAll(/^\| `([^`]+)` \| `([^`]+)` \|/gmu)].map((match) => [match[1], match[2]]));
const expected = new Map(Object.entries(manifest.productCapabilities));
const failures = [];
for (const [capability, status] of expected) if (documented.get(capability) !== status) failures.push(`${capability} must be documented as ${status}`);
for (const capability of documented.keys()) if (!expected.has(capability)) failures.push(`${capability} is documented but absent from the product ledger`);
if (!guide.includes("private beta") || !guide.includes("preview")) failures.push("current release stage and channel are missing");
if (failures.length > 0) {
  console.error(`Product capability verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Product capability ledger verified (${expected.size} outcome-level capabilities).`);
