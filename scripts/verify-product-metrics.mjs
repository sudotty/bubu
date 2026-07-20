import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const contract = read("packages/contracts/src/product-metrics.ts");
const store = read("apps/desktop/src/main/product-metrics.ts");
const renderer = ["ConversationWorkbench.tsx", "DatasetAnalysis.tsx", "DatasetGroupAnalysis.tsx", "ArtifactInspector.tsx"].map((name) => read(`apps/desktop/src/renderer/${name}`)).join("\n");
const failures = [];
for (const field of ["name", "targetKind", "outcome", "durationMs", "rowCount", "columnCount"]) if (!contract.includes(`${field}:`)) failures.push(`metric contract missing ${field}`);
for (const forbidden of ["question", "prompt", "modelOutput", "credential", "filePath", "rowValue", "cellValue", "threadId"]) if (contract.includes(`${forbidden}:`)) failures.push(`metric contract exposes forbidden field ${forbidden}`);
if (!contract.includes(".strict()")) failures.push("metric contract must reject extra fields");
if (!store.includes('join(directory, "events.ndjson")') || /https?:|fetch\(|net\.|request\(/u.test(store)) failures.push("metrics store must remain local-only NDJSON");
for (const match of renderer.matchAll(/recordProductMetric\(\{([^}]*)\}\)/gu)) {
  if (/\b(?:question|prompt|output|credential|path|rowValue|cellValue|threadId)\s*:/u.test(match[1] ?? "")) failures.push(`renderer metric includes content-like payload: ${match[0]}`);
}
if (failures.length) {
  console.error(`Product metrics verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Product metrics verified: strict bounded events, local-only storage, and no content fields.");
