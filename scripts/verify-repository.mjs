import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

const requiredFiles = [
  "AGENTS.md",
  "PRODUCT_MANIFEST.yaml",
  "docs/adr/0001-electron-shell-go-data-core-and-optional-hub.md",
  "docs/adr/0002-local-sqlite-and-hub-postgresql.md",
  "docs/adr/0003-provider-neutral-ai-tools-and-mcp.md",
  "docs/adr/0004-privacy-gateway-and-safe-query-plans.md",
  "docs/architecture/local-data-kernel.md",
  "docs/architecture/cancellation-and-operation-budgets.md",
  "docs/architecture/privacy-and-model-providers.md",
  "docs/architecture/local-conversations.md",
  "docs/architecture/mcp-host-security.md",
  "docs/plans/2026-07-17-bubu-product-platform-design.md",
  "docs/plans/2026-07-17-electron-migration-implementation.md",
  "docs/plans/2026-07-17-bounded-aggregate-agent-implementation.md",
  "docs/plans/2026-07-17-local-mcp-inspection-implementation.md",
  "docs/performance/reference-desktop-2026-07-17.md",
  "docs/product/importing-data.md",
  "docs/product/data-quality-and-validation.md",
  "docs/product/dataset-groups-and-relationships.md",
  "docs/product/exporting-and-deleting.md",
  "docs/product/backup-and-recovery.md",
  "docs/product/querying-and-visualizations.md",
  "docs/product/repeatable-workflows.md",
];

for (const path of requiredFiles) {
  try {
    statSync(resolve(root, path));
  } catch {
    failures.push(`missing required contract: ${path}`);
  }
}

const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const forbiddenTracked = [
  /(^|\/)\.DS_Store$/u,
  /(^|\/)config\.ya?ml$/u,
  /\.db(?:-shm|-wal)?$/u,
  /(^|\/)uploads\//u,
  /^bubu-bi\/bubu-bi$/u,
  /(^|\/)node_modules\//u,
  /(^|\/)dist\//u,
];

for (const path of tracked) {
  if (forbiddenTracked.some((pattern) => pattern.test(path))) {
    failures.push(`forbidden tracked runtime artifact: ${path}`);
  }
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/u,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  /\bghp_[A-Za-z0-9]{30,}\b/u,
  /\bAIza[0-9A-Za-z_-]{30,}\b/u,
];
const textExtensions = /(?:^|\/)(?:[^/]+\.(?:c|css|go|html|js|json|jsx|md|mjs|sql|ts|tsx|txt|yaml|yml)|AGENTS\.md|README)$/u;

for (const path of repositoryFiles) {
  if (!textExtensions.test(path)) continue;
  const absolutePath = resolve(root, path);
  if (statSync(absolutePath).size > 1_000_000) continue;
  const contents = readFileSync(absolutePath, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(contents))) {
    failures.push(`possible credential in tracked text: ${path}`);
  }
}

const manifest = readFileSync(resolve(root, "PRODUCT_MANIFEST.yaml"), "utf8");
for (const required of [
  "desktop: electron",
  "renderer: sandboxed-react",
  "aiRuntime: node-utility-process",
  "dataCore: go-sidecar",
  "remoteRawRowsByDefault: false",
  "csv-import: implemented",
  "xlsx-import: implemented",
  "atomic-batch-import: implemented",
  "streaming-large-csv-import: implemented",
  "reference-100mib-performance-gate: implemented",
  "reference-100k-query-budget: implemented",
  "dataset-preview: implemented",
  "same-schema-replacement: implemented",
  "schema-drift-detection: implemented",
  "schema-drift-mapping: implemented",
  "local-quality-report: implemented",
  "profiling: implemented",
  "local-column-distributions: implemented",
  "numeric-histograms: implemented",
  "categorical-top-values: implemented",
  "persistent-validation-rules: implemented",
  "validation: implemented",
  "model-context-boundary: implemented",
  "synthetic-examples: implemented",
  "fail-closed-model-audit: implemented",
  "append-only-model-disclosure-ledger: implemented",
  "provider-usage-accounting: implemented",
  "crash-recovered-model-audits: implemented",
  "model-provider-registry: implemented",
  "os-encrypted-provider-credentials: implemented",
  "provider-connection-test: implemented",
  "provider-request-adapters: implemented",
  "safe-query-plan: implemented",
  "natural-language-query-planning: implemented",
  "visible-query-approval: implemented",
  "local-bounded-query-execution: implemented",
  "dataset-groups: implemented",
  "multi-table-query: implemented",
  "bounded-lookup-joins: implemented",
  "reusable-dataset-relationships: implemented",
  "deterministic-relationship-discovery: implemented",
  "dataset-export: implemented",
  "excel-safe-csv-export: implemented",
  "permanent-dataset-deletion: implemented",
  "group-repair-on-dataset-delete: implemented",
  "consistent-local-backup: implemented",
  "verified-backup-restore: implemented",
  "crash-safe-database-restore: implemented",
  "group-natural-language-query-planning: implemented",
  "group-query-approval: implemented",
  "local-result-visualizations: implemented",
  "bar-chart: implemented",
  "time-series-chart: implemented",
  "dataset-conversations: implemented",
  "group-conversations: implemented",
  "append-only-local-conversation-history: implemented",
  "typed-conversation-artifacts: implemented",
  "manual-query-workflows: implemented",
  "versioned-workflow-definitions: implemented",
  "workflow-current-version-rebinding: implemented",
  "workflow-idempotency: implemented",
  "workflow-retry-budgets: implemented",
  "workflow-step-checkpoints: implemented",
  "workflow-local-run-audit: implemented",
  "cancellable-workflow-runs: implemented",
  "persistent-workflow-trigger-queue: implemented",
  "interval-workflow-triggers: implemented",
  "dataset-version-workflow-triggers: implemented",
  "restart-recovered-workflow-triggers: implemented",
  "atomic-trigger-conversation-delivery: implemented",
  "in-app-automation-reminders: implemented",
  "bounded-aggregate-model-disclosure: implemented",
  "exact-aggregate-disclosure-preview: implemented",
  "one-time-aggregate-approval: implemented",
  "cited-aggregate-explanations: implemented",
  "bounded-aggregate-agent-runs: implemented",
  "fixed-agent-turn-tool-time-budgets: implemented",
  "approved-cell-only-agent-tools: implemented",
  "audited-agent-turn-correlation: implemented",
  "local-mcp-connection-registry: implemented",
  "os-encrypted-mcp-environment: implemented",
  "explicit-mcp-process-launch-consent: implemented",
  "mcp-stdio-lifecycle-negotiation: implemented",
  "bounded-mcp-capability-discovery: implemented",
  "named-operation-cancellation: implemented",
  "cancellable-data-core-operations: implemented",
  "cancellable-model-requests: implemented",
  "bounded-operation-deadlines: implemented",
]) {
  if (!manifest.includes(required)) {
    failures.push(`manifest invariant missing: ${required}`);
  }
}

const acceptedDesign = readFileSync(
  resolve(root, "docs/plans/2026-07-17-bubu-product-platform-design.md"),
  "utf8",
);
if (!acceptedDesign.includes("### D. Electron shell, Node AI runtime, Go data core, and optional Hub")) {
  failures.push("accepted architecture alternative is not the Electron/Node/Go design");
}
if (acceptedDesign.includes("### C. Modular Wails monolith plus optional Hub\n\nAccepted")) {
  failures.push("stale accepted Wails architecture remains in the product design");
}

if (failures.length > 0) {
  console.error("Repository verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Repository verification passed (${tracked.length} tracked paths and ${repositoryFiles.length} workspace files checked).`,
);
