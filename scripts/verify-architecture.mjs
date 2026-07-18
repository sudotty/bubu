import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function sourceFiles(directory, extensions = [".ts", ".tsx"]) {
  const result = [];
  const visit = (absolutePath) => {
    for (const entry of readdirSync(absolutePath)) {
      const child = join(absolutePath, entry);
      if (statSync(child).isDirectory()) visit(child);
      else if (extensions.includes(extname(child))) result.push(child);
    }
  };
  visit(join(root, directory));
  return result;
}

const rendererFiles = sourceFiles("apps/desktop/src/renderer");
for (const path of rendererFiles) {
  const contents = readFileSync(path, "utf8");
  for (const forbidden of [/from ["']electron["']/u, /from ["']node:/u, /\bipcRenderer\b/u]) {
    if (forbidden.test(contents)) {
      failures.push(`renderer crosses desktop privilege boundary: ${path.slice(root.length + 1)}`);
    }
  }
}

const resultVisualization = read("apps/desktop/src/renderer/ResultVisualization.tsx");
if (!resultVisualization.includes("deriveVisualizationSpec(result, title)")) {
  failures.push("result visualization is not derived through the typed local contract");
}
if (/dangerouslySetInnerHTML|innerHTML/u.test(resultVisualization)) {
  failures.push("result visualization renders untrusted HTML");
}

const dataCoreFiles = sourceFiles("services/data-core/internal", [".go"]);
for (const path of dataCoreFiles) {
  const lineCount = readFileSync(path, "utf8").split("\n").length;
  if (lineCount > 350) {
    failures.push(`data-core source mixes too many responsibilities (${lineCount} lines): ${path.slice(root.length + 1)}`);
  }
}

const preload = read("apps/desktop/src/preload.ts");
if (!preload.includes('contextBridge.exposeInMainWorld("bubu", desktopApi)')) {
  failures.push("preload does not expose the named BuBu product API");
}
if (preload.includes("send(") || preload.includes("on(") || preload.includes("removeListener")) {
  failures.push("preload exposes event-shaped or generic IPC behavior");
}
if (preload.includes("appendConversation")) {
  failures.push("preload exposes privileged conversation writes");
}

const conversations = read("services/data-core/internal/data/conversation.go");
for (const invariant of [
  "maximumConversationEntries = 500",
  "maximumConversationPayload = 1024 * 1024",
  "a conversation must start with a user question",
  "INSERT INTO conversation_entries",
]) {
  if (!conversations.includes(invariant)) failures.push(`conversation invariant missing: ${invariant}`);
}

const security = read("apps/desktop/src/main/security.ts");
for (const invariant of [
  "nodeIntegration: false",
  "nodeIntegrationInWorker: false",
  "contextIsolation: true",
  "sandbox: true",
  "webSecurity: true",
  "allowRunningInsecureContent: false",
  "webviewTag: false",
]) {
  if (!security.includes(invariant)) failures.push(`desktop security invariant missing: ${invariant}`);
}

const main = read("apps/desktop/src/main.ts");
for (const invariant of [
  "setPermissionCheckHandler(() => false)",
  'setWindowOpenHandler(() => ({ action: "deny" }))',
  'protocol.registerSchemesAsPrivileged',
  "safeStorage.isEncryptionAvailable()",
  "safeStorage.encryptString(value)",
]) {
  if (!main.includes(invariant)) failures.push(`main-process security gate missing: ${invariant}`);
}

const desktopApi = read("apps/desktop/src/main/desktop-api.ts");
if (!desktopApi.includes("isTrustedFrameUrl(frameUrl")) {
  failures.push("desktop API is missing sender-origin validation");
}
for (const invariant of [
  "replacementSessions.issue(datasetID, sourcePath)",
  "replacementSessions.consume(input.replacementToken)",
  "randomBytes(16).toString(\"hex\")",
]) {
  if (!desktopApi.includes(invariant)) failures.push(`replacement path boundary missing: ${invariant}`);
}

const replacementMapping = read("services/data-core/internal/data/replacement_mapping.go");
for (const invariant of [
  "len(mappings) != len(currentColumns)",
  "incoming column %q is mapped more than once",
  "mappedRow := make([]string, len(orderedIndexes))",
]) {
  if (!replacementMapping.includes(invariant)) failures.push(`replacement mapping invariant missing: ${invariant}`);
}

const qualityRules = read("services/data-core/internal/data/quality_rules.go");
for (const invariant of [
  "maximumValidationRules = 100",
  "regexp.Compile(rule.Pattern)",
  "number-range rule requires a numeric column",
  "allowed values must be unique",
]) {
  if (!qualityRules.includes(invariant)) failures.push(`validation rule invariant missing: ${invariant}`);
}
const qualityValidation = read("services/data-core/internal/data/quality_validation.go");
for (const invariant of [
  "maximumValidationSamples = 20",
  'predicates = append(predicates, "CAST("+physical+" AS REAL) < ?")',
  "expression.MatchString(value.String)",
  "args[index] = value",
]) {
  if (!qualityValidation.includes(invariant)) failures.push(`local validation invariant missing: ${invariant}`);
}
const qualityContract = read("packages/contracts/src/quality.ts");
if (qualityContract.includes("failingValues")) {
  failures.push("quality contract exposes raw failing values");
}
const localDistribution = read("services/data-core/internal/data/distribution.go");
for (const invariant of [
  "distributionBinCount     = 10",
  "distributionValueCount   = 10",
  "distributionPreviewRunes = 120",
  "SELECT substr(%s, 1, ?)",
  "ORDER BY COUNT(*) DESC",
  "strings.Map(safeDistributionRune, preview)",
]) {
  if (!localDistribution.includes(invariant)) failures.push(`local distribution invariant missing: ${invariant}`);
}
const distributionContract = read("packages/contracts/src/distribution.ts");
if (!distributionContract.includes("localOnly: z.literal(true)")) {
  failures.push("column distribution is not explicitly local-only");
}

const relationshipDiscovery = read("services/data-core/internal/data/relationship_discovery.go");
for (const invariant of [
  "maximumRelationshipCandidates",
  "rightColumn.NullCount != 0",
  "rightColumn.DistinctCount != right.rowCount",
  'relationshipIssueValue("right-not-unique")',
]) {
  if (!relationshipDiscovery.includes(invariant)) failures.push(`relationship invariant missing: ${invariant}`);
}

const datasetExport = read("services/data-core/internal/data/export.go");
for (const invariant of [
  "os.CreateTemp(filepath.Dir(absolutePath)",
  "temporary.Write([]byte{0xef, 0xbb, 0xbf})",
  "excelSafeCSVCell(value.String",
  "temporary.Chmod(0o600)",
  "FileName: filepath.Base(absolutePath)",
]) {
  if (!datasetExport.includes(invariant)) failures.push(`safe export invariant missing: ${invariant}`);
}
const lifecycleContract = read("packages/contracts/src/lifecycle.ts");
if (!lifecycleContract.includes("Only a file name may cross into the renderer")) {
  failures.push("dataset lifecycle contract does not keep export paths private");
}
const datasetDeletion = read("services/data-core/internal/data/deletion.go");
for (const invariant of [
  "DELETE FROM conversation_threads WHERE target_kind = 'dataset'",
  "DELETE FROM dataset_groups WHERE id = ?",
  'transaction.ExecContext(ctx, "DROP TABLE "+tableName)',
  "transaction.Commit()",
]) {
  if (!datasetDeletion.includes(invariant)) failures.push(`dataset deletion invariant missing: ${invariant}`);
}
const lifecycleApi = read("apps/desktop/src/main/dataset-lifecycle-api.ts");
for (const invariant of ["dialog.showSaveDialog", "dialog.showMessageBox", "showOverwriteConfirmation", "此操作无法撤销"]) {
  if (!lifecycleApi.includes(invariant)) failures.push(`desktop lifecycle boundary missing: ${invariant}`);
}

const dataBackup = read("services/data-core/internal/data/backup.go");
for (const invariant of [
  '"VACUUM main INTO ?"',
  "DatabaseSHA256:  digest",
  "copyWithContext(ctx, databaseEntry, snapshot)",
  "temporary.Chmod(0o600)",
]) {
  if (!dataBackup.includes(invariant)) failures.push(`local backup invariant missing: ${invariant}`);
}
const windowsFileReplacement = read("services/data-core/internal/data/replace_file_windows.go");
for (const invariant of ["windows.MoveFileEx", "windows.MOVEFILE_REPLACE_EXISTING", "windows.MOVEFILE_WRITE_THROUGH"]) {
  if (!windowsFileReplacement.includes(invariant)) failures.push(`Windows atomic file replacement missing: ${invariant}`);
}
const backupValidation = read("services/data-core/internal/data/backup_validation.go");
for (const invariant of [
  '"PRAGMA integrity_check"',
  '"PRAGMA foreign_key_check"',
  'objectType',
  'source_locator <> \'\'',
  "maximumConversationEntries",
]) {
  if (!backupValidation.includes(invariant)) failures.push(`backup validation invariant missing: ${invariant}`);
}
const dataRestore = read("services/data-core/internal/data/restore.go");
for (const invariant of [
  "strictBackupEntries(archive.File)",
  "manifest.DatabaseSHA256",
  'service.databasePath + ".restore-rollback"',
  "service.rollbackDatabaseRestore",
]) {
  if (!dataRestore.includes(invariant)) failures.push(`backup restore invariant missing: ${invariant}`);
}
const backupContract = read("packages/contracts/src/backup.ts");
if (!backupContract.includes("Only a backup file name may cross into the renderer")) {
  failures.push("backup contract exposes more than a safe file name");
}
const backupApi = read("apps/desktop/src/main/backup-api.ts");
for (const invariant of ["dialog.showSaveDialog", "dialog.showOpenDialog", "dialog.showMessageBox", "验证并恢复"]) {
  if (!backupApi.includes(invariant)) failures.push(`desktop backup boundary missing: ${invariant}`);
}
const analysisOrchestrator = read("apps/desktop/src/main/analysis-orchestrator.ts");
for (const invariant of [
  'relationship.status !== "ready"',
  "leftSourceIndex >= rightSourceIndex",
  "relationships: readonly RelationshipHint[]",
  "disclosedRelationships: relationships",
]) {
  if (!analysisOrchestrator.includes(invariant)) failures.push(`relationship disclosure invariant missing: ${invariant}`);
}
if (analysisOrchestrator.includes("distribution")) {
  failures.push("raw local distributions entered the model planning boundary");
}

const providerStore = read("apps/desktop/src/main/provider-store.ts");
for (const invariant of [
  'join(options.directory, "credentials")',
  "preparePrivateDirectory(options.directory)",
  "preparePrivateDirectory(credentialsDirectory)",
  "atomicPrivateWrite(credentialPath(id)",
  "Credential encryption is unavailable",
]) {
  if (!providerStore.includes(invariant)) failures.push(`provider credential boundary missing: ${invariant}`);
}
const secureFiles = read("apps/desktop/src/main/secure-files.ts");
for (const invariant of [
  "mode: 0o700",
  "mode: 0o600",
  "renameSync(temporaryPath, path)",
]) {
  if (!secureFiles.includes(invariant)) failures.push(`private file persistence boundary missing: ${invariant}`);
}
if (providerStore.includes("credential:" + " input.credential")) {
  failures.push("provider credential is copied into registry metadata");
}

const sidecars = read("apps/desktop/src/main/sidecars.ts");
if (!sidecars.includes("utilityProcess.fork")) failures.push("AI runtime is not an Electron utility process");
if (!sidecars.includes('BUBU_RPC_TOKEN')) failures.push("sidecars are missing per-process credentials");
for (const invariant of ["10 * 60_000", "130_000", "requestOptions(signal)"]) {
  if (!sidecars.includes(invariant)) failures.push(`sidecar operation budget missing: ${invariant}`);
}

const operationContract = read("packages/contracts/src/operation.ts");
for (const invariant of ["z.string().uuid()", "operationStartSchema", "operationEnvelopeSchema", ".strict()"] ) {
  if (!operationContract.includes(invariant)) failures.push(`operation identity contract missing: ${invariant}`);
}
const operationRegistry = read("apps/desktop/src/main/operation-registry.ts");
for (const invariant of ["new AbortController()", "active.has(operationId)", "controller?.abort()", "active.delete(operationId)"]) {
  if (!operationRegistry.includes(invariant)) failures.push(`desktop operation registry invariant missing: ${invariant}`);
}
const rpcBroker = read("apps/desktop/src/main/rpc-broker.ts");
for (const invariant of ['method: "system.cancel"', "params: { requestId: id }", "options.signal", "options.timeoutMs"]) {
  if (!rpcBroker.includes(invariant)) failures.push(`RPC cancellation invariant missing: ${invariant}`);
}
const dataCoreServer = read("services/data-core/internal/rpc/server.go");
for (const invariant of ['request.Method == "system.cancel"', "for job := range jobs", "context.WithCancel", '"CANCELLED"']) {
  if (!dataCoreServer.includes(invariant)) failures.push(`serialized data cancellation invariant missing: ${invariant}`);
}
const aiDispatcher = read("services/ai-runtime/src/dispatcher.ts");
for (const invariant of ['request.method === "system.cancel"', "new AbortController()", "controller?.abort()", "active.delete(request.id)"]) {
  if (!aiDispatcher.includes(invariant)) failures.push(`AI cancellation invariant missing: ${invariant}`);
}
const providerInvocation = read("services/ai-runtime/src/providers/invoke.ts");
if (!providerInvocation.includes("AbortSignal.any([signal, AbortSignal.timeout(120_000)])")) {
  failures.push("provider request does not combine user cancellation with its network deadline");
}

const modelAudit = read("apps/desktop/src/main/model-audit.ts");
for (const invariant of [
  "runtime.startModelAudit(buildModelAuditStart(invocation, scope))",
  "runtime.generateModel(invocation, signal)",
  "runtime.finishModelAudit",
  'createHash("sha256")',
  "containsRawRows: false",
  'new URL(invocation.provider.baseUrl).origin',
  "aggregateRowCount: scope.aggregateRowCount ?? 0",
]) {
  if (!modelAudit.includes(invariant)) failures.push(`model audit boundary missing: ${invariant}`);
}
for (const path of sourceFiles("apps/desktop/src/main")) {
  if (path.endsWith("model-audit.ts") || path.endsWith(".test.ts")) continue;
  if (readFileSync(path, "utf8").includes(".generateModel(")) {
    failures.push(`model invocation bypasses the disclosure ledger: ${path.slice(root.length + 1)}`);
  }
}
const modelAuditValidation = read("services/data-core/internal/data/model_audit_validation.go");
for (const invariant of [
  "maximumModelAuditEvents  = 100_000",
  "maximumModelPayloadBytes = 250_000",
  "input.ContainsRawRows",
  "validateModelAuditEvent",
  'input.Purpose == "aggregate-explanation"',
  'input.Disclosure != "aggregates"',
]) {
  if (!modelAuditValidation.includes(invariant)) failures.push(`model audit data-core invariant missing: ${invariant}`);
}
const modelAuditStore = read("services/data-core/internal/data/model_audit_store.go");
for (const invariant of [
  "INSERT INTO model_disclosure_events(",
  "INSERT INTO model_disclosure_outcomes(",
  "NOT EXISTS (",
  "LEFT JOIN model_disclosure_outcomes",
]) {
  if (!modelAuditStore.includes(invariant)) failures.push(`append-only model ledger invariant missing: ${invariant}`);
}
if (modelAuditStore.includes("UPDATE model_disclosure_")) {
  failures.push("model disclosure ledger mutates an existing audit row");
}
const modelAuditMigration = read("services/data-core/internal/data/model_audit_migration.go");
for (const invariant of ["aggregate-explanation", "aggregate_row_count", "disclosure IN ('none', 'schema-only', 'schema-synthetic', 'aggregates')"]) {
  if (!modelAuditMigration.includes(invariant)) failures.push(`aggregate disclosure migration invariant missing: ${invariant}`);
}
const modelAuditPurposeMigration = read("services/data-core/internal/data/model_audit_purpose_migration.go");
for (const invariant of ["model_disclosure_purposes", "'aggregate-agent'", "FROM model_disclosure_events_v11"]) {
  if (!modelAuditPurposeMigration.includes(invariant)) failures.push(`evolvable model audit purpose migration missing: ${invariant}`);
}

const aggregateDisclosure = read("apps/desktop/src/main/aggregate-disclosure.ts");
for (const invariant of [
  "maximumDisclosedAggregateRows = 50",
  "minimumAggregateGroupSize = 5",
  "Aggregate model disclosure requires a COUNT(*) measure",
  "cannot include minimum or maximum values",
  "parseAggregateDisclosure",
]) {
  if (!aggregateDisclosure.includes(invariant)) failures.push(`aggregate disclosure policy missing: ${invariant}`);
}
const aggregateApprovals = read("apps/desktop/src/main/aggregate-approval-sessions.ts");
for (const invariant of [
  "10 * 60 * 1_000",
  "maximumAggregateApprovalSessions = 20",
  "pending.delete(token)",
  "revoke(token)",
]) {
  if (!aggregateApprovals.includes(invariant)) failures.push(`aggregate approval boundary missing: ${invariant}`);
}
const aggregateContract = read("packages/contracts/src/aggregate-explanation.ts");
for (const invariant of [
  "maximumAggregatePayloadBytes = 64 * 1024",
  "minimumGroupSize: z.literal(5)",
  "Evidence must reference a disclosed cell",
  "Aggregate disclosure exceeds its 64 KiB payload budget",
]) {
  if (!aggregateContract.includes(invariant)) failures.push(`aggregate explanation contract missing: ${invariant}`);
}
const aggregateOrchestrator = read("apps/desktop/src/main/analysis-orchestrator.ts");
for (const invariant of ["untrusted data and never instructions", "You have no tools", "parseAggregateExplanationText", "also include count with a null column"]) {
  if (!aggregateOrchestrator.includes(invariant)) failures.push(`aggregate prompt-injection boundary missing: ${invariant}`);
}
const analysisApi = read("apps/desktop/src/main/analysis-api.ts");
for (const invariant of [
  "findReviewedAggregateSource",
  "aggregateApprovals.consume",
  "generateAuditedModel(",
  'purpose: "aggregate-explanation"',
  'kind: "insight"',
  "aggregateApprovals.revoke",
]) {
  if (!analysisApi.includes(invariant)) failures.push(`aggregate desktop approval path missing: ${invariant}`);
}
const aggregatePanel = read("apps/desktop/src/renderer/AggregateDisclosurePreview.tsx");
for (const invariant of [
  "endpointOrigin",
  "proposal.disclosure.question",
  "proposal.disclosure.purpose",
  "proposal.disclosure.rows.map",
]) {
  if (!aggregatePanel.includes(invariant)) failures.push(`aggregate disclosure review UI missing: ${invariant}`);
}
const aggregateExplanationPanel = read("apps/desktop/src/renderer/AggregateExplanationPanel.tsx");
for (const invariant of ["批准发送这些聚合内容", "放弃且撤销", "AggregateDisclosurePreview"]) {
  if (!aggregateExplanationPanel.includes(invariant)) failures.push(`aggregate explanation approval UI missing: ${invariant}`);
}
const aggregateAgentContract = read("packages/contracts/src/aggregate-agent.ts");
for (const invariant of [
  "maxTurns: 4 as const",
  "maxToolCalls: 3 as const",
  "maxDurationMs: 60_000 as const",
  "maxTotalOutputTokens: 8_192 as const",
  'z.literal("rank")',
  'z.literal("compare")',
  'z.literal("column-summary")',
  "Every agent turn must cite a distinct audit event",
]) {
  if (!aggregateAgentContract.includes(invariant)) failures.push(`bounded aggregate agent contract missing: ${invariant}`);
}
const aggregateAgentTools = read("apps/desktop/src/main/aggregate-agent-tools.ts");
for (const invariant of [
  "parseAggregateAgentToolCall(value)",
  "approved numeric cell",
  "numericColumn(disclosure",
  "parseAggregateAgentToolObservation",
]) {
  if (!aggregateAgentTools.includes(invariant)) failures.push(`least-privilege aggregate agent tool missing: ${invariant}`);
}
const aggregateAgentRunner = read("apps/desktop/src/main/aggregate-agent-runner.ts");
for (const invariant of [
  "AbortSignal.timeout(aggregateAgentBudget.maxDurationMs)",
  "AbortSignal.any([signal, timeoutSignal])",
  "turn <= aggregateAgentBudget.maxTurns",
  "observations.length >= aggregateAgentBudget.maxToolCalls",
  "parseAggregateAgentDecisionText",
]) {
  if (!aggregateAgentRunner.includes(invariant)) failures.push(`bounded aggregate agent runner missing: ${invariant}`);
}
const aggregateAgentApprovals = read("apps/desktop/src/main/aggregate-agent-approval-sessions.ts");
for (const invariant of [
  "10 * 60 * 1_000",
  "maximumAggregateAgentApprovalSessions = 20",
  "pending.delete(token)",
  "budget: aggregateAgentBudget",
]) {
  if (!aggregateAgentApprovals.includes(invariant)) failures.push(`aggregate agent approval boundary missing: ${invariant}`);
}
for (const invariant of [
  "aggregateAgentApprovals.consume",
  "runBoundedAggregateAgent",
  "generateAuditedModelWithAudit",
  'purpose: "aggregate-agent"',
  "auditId: generated.audit.id",
  "aggregateAgentApprovals.revoke",
]) {
  if (!analysisApi.includes(invariant)) failures.push(`audited aggregate agent desktop path missing: ${invariant}`);
}
const aggregateAgentPanel = read("apps/desktop/src/renderer/AggregateAgentPanel.tsx");
for (const invariant of [
  "审查 Agent 的数据与预算",
  "proposal.budget.maxTurns",
  "固定只读工具",
  "批准此数据、模型与固定预算",
]) {
  if (!aggregateAgentPanel.includes(invariant)) failures.push(`aggregate agent review UI missing: ${invariant}`);
}
const conversationContract = read("packages/contracts/src/conversation.ts");
for (const invariant of ["sourcePlan", "same immutable source", "insightEntryInputSchema", "agentRun: aggregateAgentRunSchema"]) {
  if (!conversationContract.includes(invariant)) failures.push(`source-linked aggregate conversation invariant missing: ${invariant}`);
}
const conversationMigration = read("services/data-core/internal/data/conversation_migration.go");
for (const invariant of [
  "conversationInsightMigrationSQL",
  "'question', 'plan', 'result', 'insight', 'error'",
  "FROM conversation_entries_v10",
]) {
  if (!conversationMigration.includes(invariant)) failures.push(`aggregate insight persistence migration missing: ${invariant}`);
}

const workflowValidation = read("services/data-core/internal/data/workflow_validation.go");
for (const invariant of [
  "maximumWorkflowDefinitions = 500",
  "maximumWorkflowSteps       = 8",
  "maximumWorkflowAttempts    = 3",
  "maximumWorkflowRuns        = 10_000",
  "maximumWorkflowJSONBytes   = 1024 * 1024",
  'case "manual", "dataset-version":',
  'case "interval":',
]) {
  if (!workflowValidation.includes(invariant)) failures.push(`workflow budget invariant missing: ${invariant}`);
}
const workflowRunner = read("services/data-core/internal/data/workflow_run.go");
for (const invariant of [
  "getWorkflowRunByIdempotency",
  "context.WithTimeout",
  "step.MaximumAttempts",
  "current_version_id",
  "workflow group membership order changed",
  "finishWorkflowStepRun",
]) {
  if (!workflowRunner.includes(invariant)) failures.push(`workflow execution invariant missing: ${invariant}`);
}
const workflowMigration = read("services/data-core/internal/data/migrations.go");
for (const invariant of [
  "CREATE TABLE workflow_definitions",
  "CREATE TABLE workflow_runs",
  "CREATE TABLE workflow_step_runs",
  "UNIQUE (workflow_id, idempotency_key)",
  "UNIQUE (run_id, ordinal, attempt)",
  "CREATE TABLE workflow_trigger_events",
  "UNIQUE (workflow_id, dedupe_key)",
]) {
  if (!workflowMigration.includes(invariant)) failures.push(`workflow persistence invariant missing: ${invariant}`);
}
const workflowTrigger = read("services/data-core/internal/data/workflow_trigger.go");
for (const invariant of [
  "maximumWorkflowTriggerEvents = 10_000",
  "currentWorkflowTargetSignature",
  "newOperationID",
  "INSERT OR IGNORE INTO workflow_trigger_events",
  "listPendingWorkflowTriggers",
]) {
  if (!workflowTrigger.includes(invariant)) failures.push(`workflow trigger invariant missing: ${invariant}`);
}
const workflowTriggerFinish = read("services/data-core/internal/data/workflow_trigger_finish.go");
for (const invariant of [
  "appendExistingConversationEntry",
  "triggeredWorkflowConversationEntry",
  '"sourcePlan": json.RawMessage(rawInput)',
  "transaction.Commit()",
  "events.status = 'pending'",
]) {
  if (!workflowTriggerFinish.includes(invariant)) failures.push(`workflow trigger delivery invariant missing: ${invariant}`);
}
const workflowScheduler = read("apps/desktop/src/main/workflow-trigger-scheduler.ts");
for (const invariant of ["claimDueWorkflowTriggers", "event.operationId", "finishWorkflowTrigger", "AUTOMATION_POLL_INTERVAL_MILLISECONDS"]) {
  if (!workflowScheduler.includes(invariant)) failures.push(`workflow trigger scheduler invariant missing: ${invariant}`);
}
const automationRefresh = read("apps/desktop/src/shared/automation.ts");
if (!automationRefresh.includes("AUTOMATION_POLL_INTERVAL_MILLISECONDS = 30_000")) {
  failures.push("automation scheduling and renderer refresh do not share the bounded 30-second interval");
}
const conversationRefresh = read("apps/desktop/src/renderer/useConversationThread.ts");
for (const invariant of ["window.bubu.conversations.get(target)", "inFlight", "AUTOMATION_POLL_INTERVAL_MILLISECONDS"]) {
  if (!conversationRefresh.includes(invariant)) failures.push(`in-app automation reminder refresh missing: ${invariant}`);
}
const workflowPanel = read("apps/desktop/src/renderer/WorkflowPanel.tsx");
if (!workflowPanel.includes("AUTOMATION_POLL_INTERVAL_MILLISECONDS")) {
  failures.push("workflow due state does not refresh on the shared automation interval");
}
const workflowApi = read("apps/desktop/src/main/workflow-api.ts");
for (const invariant of ["containsProposedPlan", "parseWorkflowDefinitionInput", "operations.run", "envelope.operationId"]) {
  if (!workflowApi.includes(invariant)) failures.push(`workflow desktop boundary missing: ${invariant}`);
}

const tabularSource = read("services/data-core/internal/data/source.go");
if (tabularSource.includes("os.ReadFile")) {
  failures.push("tabular import reads an entire source file before parsing");
}
for (const invariant of ["io.LimitReader(file, 64*1024)", "for rowNumber := 2; ; rowNumber++", "reader.Read()"] ) {
  if (!tabularSource.includes(invariant)) failures.push(`streaming CSV invariant missing: ${invariant}`);
}
const performanceBenchmark = read("scripts/benchmark-data-core.mjs");
for (const invariant of [
  'sizeMiB < 100',
  'minimumRows: Math.ceil(number("minimum-rows", 100_000))',
  'percentile(querySamplesMs, 0.95)',
  'maximumPeakResidentMemoryMebibytes',
  'dataset.query.execute',
]) {
  if (!performanceBenchmark.includes(invariant)) failures.push(`reference performance invariant missing: ${invariant}`);
}
const rootPackage = read("package.json");
for (const invariant of ['"verify:performance"', 'npm run verify:performance', '"smoke:mcp"', 'npm run smoke:mcp']) {
  if (!rootPackage.includes(invariant)) failures.push(`root performance gate missing: ${invariant}`);
}

const mcpContract = read("packages/contracts/src/mcp.ts");
for (const invariant of [
  '"bash", "bunx", "cmd", "cmd.exe"',
  '"npm", "npm.cmd", "npx", "npx.cmd"',
  '"pipx", "pnpm", "powershell", "powershell.exe"',
  '"su", "sudo"',
  '"uvx", "yarn", "zsh"',
  "maxDurationMs: 30_000 as const",
  "maxPagesPerPrimitive: 5 as const",
  "maxItemsPerPrimitive: 100 as const",
  "maxResultBytes: 262_144 as const",
  "MCP input schema exceeds its byte budget",
  "untrustedMetadata: z.literal(true)",
  "maxDiscoveryPages: 5 as const",
  "maxDiscoveredResources: 100 as const",
  "maxContentParts: 20 as const",
  "maxDecodedBytes: 262_144 as const",
  "maxResultBytes: 393_216 as const",
  "MCP text decoded-byte count is invalid",
  "MCP resource exceeds its decoded-content budget",
  "maxDiscoveredPrompts: 100 as const",
  "maxMessages: 20 as const",
  "MCP prompt arguments exceed their combined byte budget",
  "MCP prompt exceeds its decoded-content budget",
  'warning: z.literal("untrusted-local-code-argument-disclosure-and-content")',
  "maxDiscoveredTools: 100 as const",
  "maxInputBytes: 32_768 as const",
  "maxContentParts: 20 as const",
  "MCP tool result exceeds its decoded-content budget",
  'warning: z.literal("untrusted-local-code-arguments-content-and-side-effects")',
  "localOnly: z.literal(true)",
  "untrustedContent: z.literal(true)",
]) {
  if (!mcpContract.includes(invariant)) failures.push(`MCP least-authority contract missing: ${invariant}`);
}
const mcpStore = read("apps/desktop/src/main/mcp-connection-store.ts");
for (const invariant of [
  "maximumMcpConnections = 20",
  "encryptedEnvironment",
  "options.cipher.encrypt(JSON.stringify(environment))",
  "atomicPrivateWrite(pathFor(id)",
  "connections: [...records.values()].map(({ profile }) => profile)",
]) {
  if (!mcpStore.includes(invariant)) failures.push(`encrypted MCP registry boundary missing: ${invariant}`);
}
const mcpApprovals = read("apps/desktop/src/main/mcp-inspection-approval-sessions.ts");
for (const invariant of [
  "10 * 60 * 1_000",
  "maximumMcpInspectionApprovalSessions = 20",
  "pending.delete(token)",
  "session.expiresAt <= options.now()",
  'createHash("sha256").update(JSON.stringify({ name, invocation })',
  "timingSafeEqual(",
  'warning: "untrusted-local-code"',
]) {
  if (!mcpApprovals.includes(invariant)) failures.push(`MCP launch approval boundary missing: ${invariant}`);
}
const mcpResourceApprovals = read("apps/desktop/src/main/mcp-resource-approval-sessions.ts");
for (const invariant of [
  "10 * 60 * 1_000",
  "maximumMcpResourceApprovalSessions = 20",
  "session.expiresAt <= options.now()",
  "launchFingerprint: fingerprint(proposal.connection.name, invocation)",
  "requestFingerprint: requestFingerprint(proposal.connection.name, invocation)",
  "environmentKeys: Object.keys(invocation.environment)",
  "Buffer.from(approved.launchFingerprint, \"hex\")",
  'warning: "untrusted-local-code-and-content"',
]) {
  if (!mcpResourceApprovals.includes(invariant)) failures.push(`MCP resource approval boundary missing: ${invariant}`);
}
const mcpPromptApprovals = read("apps/desktop/src/main/mcp-prompt-approval-sessions.ts");
for (const invariant of [
  "10 * 60 * 1_000",
  "maximumMcpPromptApprovalSessions = 20",
  "session.expiresAt <= options.now()",
  "launchFingerprint: launchFingerprint(proposal.connection.name, invocation)",
  "requestFingerprint: requestFingerprint(proposal.connection.name, invocation)",
  "environmentKeys: Object.keys(invocation.environment)",
  "const argumentKeys = invocation.arguments.map",
  "argumentBytes: argumentBytes(invocation)",
  "Buffer.from(approved.launchFingerprint, \"hex\")",
  'warning: "untrusted-local-code-argument-disclosure-and-content"',
]) {
  if (!mcpPromptApprovals.includes(invariant)) failures.push(`MCP prompt approval boundary missing: ${invariant}`);
}
for (const forbidden of ["argumentValues:", "environmentValues:"]) {
  if (mcpPromptApprovals.includes(forbidden)) failures.push(`MCP prompt approval retains forbidden plaintext field: ${forbidden}`);
}
const mcpToolApprovals = read("apps/desktop/src/main/mcp-tool-approval-sessions.ts");
for (const invariant of [
  "10 * 60 * 1_000",
  "maximumMcpToolApprovalSessions = 20",
  "session.expiresAt <= options.now()",
  "requestSchemaSha256 = hash(request.inputSchemaJson)",
  "requestFingerprint: requestFingerprint(proposal.connection.name, invocation)",
  "launchFingerprint: launchFingerprint(proposal.connection.name, invocation)",
  "inputKeys: inputKeys(invocation)",
  "inputBytes: inputBytes(invocation)",
  "Buffer.from(approved.launchFingerprint, \"hex\")",
  'warning: "untrusted-local-code-arguments-content-and-side-effects"',
]) {
  if (!mcpToolApprovals.includes(invariant)) failures.push(`MCP tool approval boundary missing: ${invariant}`);
}
for (const forbidden of ["argumentValues:", "environmentValues:", "resultContent:"]) {
  if (mcpToolApprovals.includes(forbidden)) failures.push(`MCP tool approval retains forbidden plaintext field: ${forbidden}`);
}
const mcpAuditStore = read("apps/desktop/src/main/mcp-audit-store.ts");
for (const invariant of [
  "maximumMcpAuditStarts = 10_000",
  "atomicPrivateCreate(startPath(start.auditId)",
  "atomicPrivateCreate(outcomePath(outcome.auditId)",
  "MCP audit outcome already exists",
  'status: activeThisProcess.has(start.auditId) ? "in-progress" as const : "interrupted" as const',
]) {
  if (!mcpAuditStore.includes(invariant)) failures.push(`append-only MCP audit boundary missing: ${invariant}`);
}
for (const forbidden of ["resourceContent", ".contents", "encryptedEnvironment", "launchFingerprint"]) {
  if (mcpAuditStore.includes(forbidden)) failures.push(`MCP audit persists forbidden content or secret-derived state: ${forbidden}`);
}
for (const invariant of ["linkSync(temporaryPath, path)", "writeFileSync(temporaryPath, value, { flag: \"wx\", mode: 0o600 })"]) {
  if (!secureFiles.includes(invariant)) failures.push(`append-only private file primitive missing: ${invariant}`);
}
const mcpApi = read("apps/desktop/src/main/mcp-api.ts");
for (const invariant of [
  "realpathSync(resolved.profile.transport.command)",
  "metadata.isFile()",
  "(metadata.mode & 0o111) === 0",
  "approvals.consume(approval.approvalToken)",
  "approvals.matches(approved, current.name, current.invocation)",
  "sidecars.inspectMcp(current.invocation, signal)",
]) {
  if (!mcpApi.includes(invariant)) failures.push(`named MCP desktop boundary missing: ${invariant}`);
}
const mcpClient = read("services/ai-runtime/src/mcp/client.ts");
for (const invariant of [
  'from "@modelcontextprotocol/sdk/client/index.js"',
  'from "@modelcontextprotocol/sdk/client/stdio.js"',
  "env: { ...invocation.environment }",
  "cwd: invocation.workingDirectory",
  "{ capabilities: {} }",
  "client.listTools",
  "client.listResources",
  "client.listPrompts",
  "AbortSignal.any([signal, timeoutSignal])",
  "await client.close().catch(() => undefined)",
  "resource.size > invocation.budget.maxDecodedBytes",
  "resource is not present in bounded discovery",
  "decodeCanonicalBase64(content.blob)",
  'createHash("sha256").update(decoded).digest("hex")',
  "parseMcpResourceReadResult({",
  "MCP prompt required argument",
  "MCP prompt argument",
  "decodeCanonicalBase64(content.data)",
  "parseMcpPromptGetResult({",
  "validateMcpToolArguments(inputSchemaJson, invocation.arguments)",
  "validateMcpToolStructuredContent(tool.outputSchema, normalResponse.structuredContent)",
  "parseMcpToolCallResult({",
]) {
  if (!mcpClient.includes(invariant)) failures.push(`MCP inspection lifecycle invariant missing: ${invariant}`);
}
if ((mcpClient.match(/client\.readResource\(/gu) ?? []).length !== 1) {
  failures.push("MCP client must contain exactly one policy-bound resource read site");
}
if ((mcpClient.match(/client\.getPrompt\(/gu) ?? []).length !== 1) {
  failures.push("MCP client must contain exactly one policy-bound prompt get site");
}
if ((mcpClient.match(/client\.callTool\(/gu) ?? []).length !== 1) {
  failures.push("MCP client must contain exactly one policy-bound tool call site");
}
for (const forbidden of ["client.subscribeResource(", "client.unsubscribeResource("]) {
  if (mcpClient.includes(forbidden)) failures.push(`MCP client gained an unapproved primitive authority: ${forbidden}`);
}
const mcpSchemaValidator = read("packages/contracts/src/mcp-tool-schema-validator.ts");
for (const invariant of [
  "coerceTypes: false",
  "useDefaults: false",
  'key === "$ref" || key === "$dynamicRef" || key === "$recursiveRef"',
  "MCP tool schemas cannot load remote references",
  "MCP tool schema uses an unsupported JSON Schema dialect",
]) {
  if (!mcpSchemaValidator.includes(invariant)) failures.push(`MCP no-network schema boundary missing: ${invariant}`);
}
const aiRuntimePackage = JSON.parse(read("services/ai-runtime/package.json"));
if (aiRuntimePackage.dependencies?.["@modelcontextprotocol/sdk"] !== "1.29.0") {
  failures.push("AI runtime does not pin the reviewed production MCP SDK v1.29.0");
}
const packageLock = JSON.parse(read("package-lock.json"));
const lockedMcpSdk = packageLock.packages?.["node_modules/@modelcontextprotocol/sdk"];
if (
  lockedMcpSdk?.version !== "1.29.0" ||
  lockedMcpSdk.license !== "MIT" ||
  typeof lockedMcpSdk.integrity !== "string" ||
  !lockedMcpSdk.integrity.startsWith("sha512-")
) {
  failures.push("reviewed MCP SDK version, MIT license, and integrity are not locked");
}
const aiHandler = read("services/ai-runtime/src/handler.ts");
for (const invariant of ['request.method === "mcp.inspect"', '"mcp-stdio-inspection"', 'request.method === "mcp.resource.read"', '"mcp-resource-read"', 'request.method === "mcp.prompt.get"', '"mcp-prompt-get"', 'request.method === "mcp.tool.call"', '"mcp-tool-call"']) {
  if (!aiHandler.includes(invariant)) failures.push(`named MCP utility RPC missing: ${invariant}`);
}
for (const invariant of [
  "listMcpConnections",
  "saveMcpConnection",
  "prepareMcpInspection",
  "approveMcpInspection",
  "dismissMcpInspection",
  "listMcpAudits",
  "prepareMcpResourceRead",
  "approveMcpResourceRead",
  "dismissMcpResourceRead",
  "prepareMcpPromptGet",
  "approveMcpPromptGet",
  "dismissMcpPromptGet",
  "prepareMcpToolCall",
  "approveMcpToolCall",
  "dismissMcpToolCall",
]) {
  if (!preload.includes(invariant)) failures.push(`named MCP preload capability missing: ${invariant}`);
}
const mcpSettings = read("apps/desktop/src/renderer/McpSettings.tsx");
for (const invariant of [
  "只保存，不启动",
  "proposal.connection.command",
  "proposal.connection.args.map",
  "proposal.connection.environmentKeys",
  "批准启动一次并只检查能力",
  "untrustedMetadata",
  "prepareResourceRead(resource.uri)",
  "resourceProposal.connection.command",
  "resourceProposal.connection.args.map",
  "批准启动一次并读取此 URI",
  "二进制正文不进入渲染器",
  "MCP 本地审计",
  "promptProposal.connection.command",
  "promptProposal.connection.args.map",
  "promptProposal.arguments.map",
  "批准启动一次并获取此提示",
  "未发送给模型或聊天",
  "校验模式并审查调用",
  "toolProposal.inputSchemaSha256",
  "批准启动一次并调用此工具",
  "未发送给模型、Agent 或工作流",
]) {
  if (!mcpSettings.includes(invariant)) failures.push(`exact MCP consent UI missing: ${invariant}`);
}
if (/dangerouslySetInnerHTML|innerHTML/u.test(mcpSettings)) {
  failures.push("MCP settings renders untrusted content as HTML");
}
const mcpResourceApi = read("apps/desktop/src/main/mcp-resource-api.ts");
for (const invariant of [
  "approvals.consume(approvalToken)",
  "approvals.matches(approved, resolved.profile.name, invocation)",
  "dependencies.audits.start({",
  "result = await dependencies.read(invocation, signal)",
  'status: "failed"',
  'status: "succeeded"',
  "sidecars.readMcpResource(invocation, readSignal)",
]) {
  if (!mcpResourceApi.includes(invariant)) failures.push(`approved MCP resource orchestration missing: ${invariant}`);
}
const mcpPromptApi = read("apps/desktop/src/main/mcp-prompt-api.ts");
for (const invariant of [
  "approvals.consume(approvalToken)",
  "parseMcpPromptGetRequest(requestValue)",
  "approvals.matches(approved, resolved.profile.name, invocation)",
  "dependencies.audits.start({",
  'operation: "prompt-get"',
  "argumentKeys: [...approved.argumentKeys]",
  "argumentBytes: approved.argumentBytes",
  "result = await dependencies.get(invocation, signal)",
  'status: "failed"',
  'status: "succeeded"',
  "sidecars.getMcpPrompt(invocation, getSignal)",
]) {
  if (!mcpPromptApi.includes(invariant)) failures.push(`approved MCP prompt orchestration missing: ${invariant}`);
}
const mcpToolApi = read("apps/desktop/src/main/mcp-tool-api.ts");
for (const invariant of [
  "approvals.consume(approvalToken)",
  "parseMcpToolCallRequest(requestValue)",
  "validateMcpToolArguments(request.inputSchemaJson, request.arguments)",
  "approvals.matches(approved, resolved.profile.name, invocation)",
  "dependencies.audits.start({",
  'operation: "tool-call"',
  "inputKeys: [...approved.inputKeys]",
  "inputBytes: approved.inputBytes",
  "result = await dependencies.call(invocation, signal)",
  'status: "failed"',
  'status: "succeeded"',
  "sidecars.callMcpTool(invocation, callSignal)",
]) {
  if (!mcpToolApi.includes(invariant)) failures.push(`approved MCP tool orchestration missing: ${invariant}`);
}
for (const forbidden of ["argument.value", "resultContent:", "structuredContentJson:"]) {
  if (mcpToolApi.includes(forbidden)) failures.push(`MCP tool audit boundary persists content: ${forbidden}`);
}
for (const forbidden of ["argument.value", "result.messages", "result.description"]) {
  if (mcpPromptApi.includes(forbidden) && forbidden !== "result.messages") failures.push(`MCP prompt audit boundary persists content: ${forbidden}`);
}
const mcpSmoke = read("scripts/smoke-mcp.mjs");
for (const invariant of [
  'requestRuntime("mcp.inspect"',
  'requestRuntime("mcp.resource.read"',
  'readFileSync(sentinel, "utf8") !== "resource\\n"',
  'JSON.stringify(resource).includes("YmluYXJ5IGZpeHR1cmU=")',
  'requestRuntime("mcp.prompt.get"',
  'readFileSync(sentinel, "utf8") !== "prompt\\n"',
  'JSON.stringify(prompt).includes("YmluYXJ5IGZpeHR1cmU=")',
  'requestRuntime("mcp.tool.call"',
  'readFileSync(sentinel, "utf8") !== "tool\\n"',
  "tool.structuredContent?.json",
]) {
  if (!mcpSmoke.includes(invariant)) failures.push(`real MCP resource smoke invariant missing: ${invariant}`);
}

const safeQuery = read("services/data-core/internal/data/query.go");
for (const invariant of [
  "validateQueryPlanShape(plan)",
  "currentVersionID != plan.VersionID",
  'parts := []string{"SELECT "',
  "args = append(args, plan.Limit+1)",
  'predicates = append(predicates, "instr("+column.physical+", ?) > 0")',
]) {
  if (!safeQuery.includes(invariant)) failures.push(`safe query compiler invariant missing: ${invariant}`);
}

const safeGroupQuery = read("services/data-core/internal/data/group_query.go");
for (const invariant of [
  "len(plan.Joins) != len(plan.Sources)-1",
  "join.RightSourceIndex != index+1",
  "rightColumn.profile.DistinctCount != sources[join.RightSourceIndex].rowCount",
  'keyword = "LEFT JOIN"',
  "args = append(args, plan.Limit+1)",
]) {
  if (!safeGroupQuery.includes(invariant)) failures.push(`safe group query invariant missing: ${invariant}`);
}

for (const path of sourceFiles("apps/desktop/src")) {
  if (path.endsWith("src/main/sidecars.ts")) continue;
  const contents = readFileSync(path, "utf8");
  if (/\b(?:spawn|exec|fork)\s*\(/u.test(contents)) {
    failures.push(`subprocess creation escaped the sidecar supervisor: ${path.slice(root.length + 1)}`);
  }
}

if (failures.length > 0) {
  console.error("Architecture verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Architecture verification passed (${rendererFiles.length} renderer files checked).`);
