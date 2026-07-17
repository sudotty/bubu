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
  "mode: 0o700",
  "mode: 0o600",
  "renameSync(temporaryPath, path)",
  "Credential encryption is unavailable",
]) {
  if (!providerStore.includes(invariant)) failures.push(`provider credential boundary missing: ${invariant}`);
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
for (const invariant of ['"verify:performance"', 'npm run verify:performance']) {
  if (!rootPackage.includes(invariant)) failures.push(`root performance gate missing: ${invariant}`);
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
