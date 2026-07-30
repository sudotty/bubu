import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";

const root = resolve(import.meta.dirname, "..");
const failures = [];

const requiredFiles = [
  "AGENTS.md",
  ".gitattributes",
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
  "docs/product/ui-ux-guidelines.md",
  "docs/product/design-qa.md",
  "docs/README.md",
  "docs/history/README.md",
  "docs/history/plans/README.md",
  "docs/strategy/README.md",
  "docs/release/README.md",
  "docs/release/release-runbook.md",
  ".github/README.md",
  "scripts/verify-github-remote.mjs",
  "apps/README.md",
  "apps/desktop/README.md",
  "services/README.md",
  "services/data-core/README.md",
  "services/data-core/internal/data/source_xlsx.go",
  "services/data-core/internal/data/source_xlsx_rows.go",
  "services/data-core/internal/data/source_xlsx_test.go",
  "services/ai-runtime/README.md",
  "services/ai-runtime/src/providers/invoke.integration.test.ts",
  "packages/README.md",
  "packages/contracts/README.md",
  "scripts/README.md",
  "scripts/npm-bulk-audit.mjs",
  "scripts/npm-bulk-audit.test.mjs",
  "scripts/go-vulnerability-policy.mjs",
  "scripts/go-vulnerability-policy.test.mjs",
  "scripts/set-product-version.mjs",
  "scripts/release-preflight.mjs",
  "scripts/release-preflight.test.mjs",
  "scripts/release-environment-config.mjs",
  "scripts/release-environment-config.test.mjs",
  "scripts/configure-release-environment.mjs",
  "scripts/validate-preview-tag.mjs",
  "scripts/validate-preview-tag.test.mjs",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/history/plans/2026-07-17-bubu-product-platform-design.md",
  "docs/history/plans/2026-07-17-electron-migration-implementation.md",
  "docs/history/plans/2026-07-17-bounded-aggregate-agent-implementation.md",
  "docs/history/plans/2026-07-17-local-mcp-inspection-implementation.md",
  "docs/history/plans/2026-07-17-approved-mcp-resource-read-implementation.md",
  "docs/history/plans/2026-07-17-approved-mcp-prompt-get-implementation.md",
  "docs/history/plans/2026-07-17-approved-mcp-tool-call-implementation.md",
  "packages/contracts/src/mcp-tool-schema-validator.ts",
  "services/ai-runtime/src/mcp/schema-validator.ts",
  "apps/desktop/src/main/mcp-tool-approval-sessions.ts",
  "apps/desktop/src/main/mcp-tool-api.ts",
  "apps/desktop/vite-forge-compat.ts",
  "apps/desktop/vite-forge-compat.test.ts",
  "docs/performance/reference-desktop-2026-07-17.md",
  "docs/product/importing-data.md",
  "docs/product/data-quality-and-validation.md",
  "docs/product/dataset-groups-and-relationships.md",
  "docs/product/exporting-and-deleting.md",
  "docs/product/backup-and-recovery.md",
  "docs/product/querying-and-visualizations.md",
  "docs/product/repeatable-workflows.md",
  "apps/desktop/resources/demo/retail-orders.csv",
  "apps/desktop/resources/demo/retail-targets.csv",
  "apps/desktop/resources/demo/retail-customers.csv",
  "apps/desktop/src/main/demo-catalog.ts",
  "packages/contracts/src/demo.ts",
  "packages/contracts/src/derived-dataset.ts",
  "services/data-core/internal/data/derived.go",
  "services/data-core/internal/data/derived_materialization.go",
  "apps/desktop/src/renderer/DatasetLineagePanel.tsx",
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
  /(^|\/)\.tasks\//u,
  /^\.trae\//u,
  /^bubu-bi\//u,
  /^docs\/plans\//u,
  /^docs\/product\/\d{4}-\d{2}-\d{2}-/u,
  /^单文件\.sql$/u,
  /(^|\/)node_modules\//u,
  /(^|\/)dist\//u,
];
const allowedTrackedConfiguration = new Set([".github/ISSUE_TEMPLATE/config.yml"]);

for (const path of tracked) {
  if (!existsSync(resolve(root, path))) continue;
  if (allowedTrackedConfiguration.has(path)) continue;
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
  if (!existsSync(absolutePath)) continue;
  if (statSync(absolutePath).size > 1_000_000) continue;
  const contents = readFileSync(absolutePath, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(contents))) {
    failures.push(`possible credential in tracked text: ${path}`);
  }
}

const manifest = loadProductManifest(root);
requireManifestFacts(manifest, [
  "desktop: electron",
  "renderer: sandboxed-react",
  "aiRuntime: node-utility-process",
  "dataCore: go-sidecar",
  "remoteRawRowsByDefault: false",
  "csv-import: implemented",
  "xlsx-import: implemented",
  "bounded-stdlib-ooxml-import: implemented",
  "atomic-batch-import: implemented",
  "bundled-retail-demo-workspace: implemented",
  "demo-relationship-and-topic-setup: implemented",
  "rollback-safe-demo-setup: implemented",
  "typed-derived-transformation-plans: implemented",
  "materialized-derived-data-objects: implemented",
  "immutable-derived-object-recompute: implemented",
  "version-level-data-lineage: implemented",
  "chained-derived-data-objects: implemented",
  "automatic-derived-object-recompute: implemented",
  "fail-closed-derived-dependency-graph: implemented",
  "idempotent-derived-recompute-queue: implemented",
  "packaged-recurring-clean-remediation-journey: implemented",
  "streaming-large-csv-import: implemented",
  "reference-100mib-performance-gate: implemented",
  "reference-100k-query-budget: implemented",
  "npm-bulk-advisory-audit: implemented",
  "module-aware-go-toolchain-evidence: implemented",
  "imported-go-package-vulnerability-gate: implemented",
  "zero-go-vulnerability-policy: implemented",
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
  "explicit-raw-row-disclosure: implemented",
  "synthetic-examples: implemented",
  "fail-closed-model-audit: implemented",
  "append-only-model-disclosure-ledger: implemented",
  "provider-usage-accounting: implemented",
  "crash-recovered-model-audits: implemented",
  "model-provider-registry: implemented",
  "os-encrypted-provider-credentials: implemented",
  "provider-connection-test: implemented",
  "provider-request-adapters: implemented",
  "loopback-provider-transport-smoke: implemented",
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
  "advanced-workflow-approval-nodes: implemented",
  "definition-bound-workflow-approval-resume: implemented",
  "restart-preserved-workflow-approvals: implemented",
  "packaged-workflow-approval-journey: implemented",
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
  "mcp-resource-read: implemented",
  "append-only-mcp-operation-audit: implemented",
  "mcp-prompt-get: implemented",
  "mcp-tool-call: implemented",
  "model-driven-mcp-tool-execution: implemented",
  "mcp-prompt-to-model: implemented",
  "mcp-streamable-http: implemented",
  "mcp-oauth: implemented",
  "external-delivery-reminders: implemented",
  "named-operation-cancellation: implemented",
  "cancellable-data-core-operations: implemented",
  "cancellable-model-requests: implemented",
  "bounded-operation-deadlines: implemented",
  "vite-8-forge-preload-compatibility: implemented",
  "complete-release-signing-preflight: implemented",
  "secure-release-environment-bootstrap: implemented",
], failures, "repository product manifest");

const dataCoreGoMod = readFileSync(resolve(root, "services/data-core/go.mod"), "utf8");
for (const retiredDependency of ["github.com/xuri/excelize", "golang.org/x/crypto"]) {
  if (dataCoreGoMod.includes(retiredDependency)) {
    failures.push(`retired XLSX dependency returned to data-core: ${retiredDependency}`);
  }
}

const xlsxSource = readFileSync(resolve(root, "services/data-core/internal/data/source_xlsx.go"), "utf8");
for (const required of [
  '"archive/zip"',
  '"encoding/xml"',
  "maximumXLSXExpandedBytes",
  "maximumXLSXSharedStringsBytes",
  "maximumXLSXWorksheetBytes",
  "external workbook relationships are not supported",
]) {
  if (!xlsxSource.includes(required)) failures.push(`bounded OOXML invariant missing: ${required}`);
}

const goVulnerabilityVerifier = readFileSync(resolve(root, "scripts/verify-go-vulnerabilities.mjs"), "utf8");
const goVulnerabilityPolicy = readFileSync(resolve(root, "scripts/go-vulnerability-policy.mjs"), "utf8");
if (
  !goVulnerabilityVerifier.includes("evaluateGoVulnerabilityReport(result.stdout)")
  || `${goVulnerabilityVerifier}${goVulnerabilityPolicy}`.includes("allowedModule")
) {
  failures.push("Go vulnerability verification must not carry an advisory allowlist");
}

const releaseEnvironmentConfigurator = readFileSync(resolve(root, "scripts/configure-release-environment.mjs"), "utf8");
for (const required of ["--repository=", "--apply", "--enable-attestations", "input: write.value", "env: childEnvironment", "--env", "release"]) {
  if (!releaseEnvironmentConfigurator.includes(required)) failures.push(`release environment bootstrap invariant missing: ${required}`);
}
if (releaseEnvironmentConfigurator.includes("--body")) {
  failures.push("release environment bootstrap must not put publisher values in process arguments");
}

const acceptedDesign = readFileSync(
  resolve(root, "docs/history/plans/2026-07-17-bubu-product-platform-design.md"),
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
