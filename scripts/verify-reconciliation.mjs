import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const failures = [];
const requireText = (source, values, label) => { for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`); };

requireText(read("packages/contracts/src/reconciliation.ts"), [
  "comparisonPlanSchema", "reconciliationPlanSchema", 'z.literal("review-required")',
  'z.enum(["one-to-one", "one-to-many"])', "maximumCandidatePairs", "timeoutMs",
  '"matched", "tolerance-matched", "left-unmatched", "right-unmatched"',
  '"left-duplicate", "right-duplicate", "conflict", "pending"', ".strict()",
  "reconciliationDefinitionSchema", "reconciliationReplayEventSchema", "quality-change", "pending replay state is inconsistent",
], "versioned reconciliation boundary");
requireText(read("packages/contracts/src/reconciliation.test.ts"), ["arbitrary SQL", "model code", "fuzzy matching", "implicit many-to-many", "unbounded candidates"], "malformed comparison rejection");
requireText(read("packages/product-core/src/reconciliation.ts"), ["canonicalComparisonPlan", "canonicalReconciliationPlan", "previewComparisonCardinality", "withinBudget", "cardinalityAllowed"], "pure reconciliation policy");
requireText(read("services/data-core/internal/data/reconciliation.go"), ["validateComparisonPlan", "validateReconciliationPlan", "ExecuteComparison", "comparison candidate budget exceeded", "comparison cancelled", '"pending"'], "Go comparison authority");
requireText(read("services/data-core/internal/data/reconciliation_test.go"), ["FailsAtomicallyOnBudgetAndCancellation", "ClassifiesWithoutAutoConfirmingDuplicates", "unsafe unresolved policy accepted"], "Go failure behavior proof");
requireText(read("services/data-core/internal/data/reconciliation_service.go"), ["PreviewReconciliation", "ExecuteReconciliation", "one-use-approval", "plan fingerprint does not match", "INSERT INTO reconciliation_artifacts", "transaction.Commit", "GetReconciliationArtifact", "new(big.Rat)", "reconciliationControlTotalResult"], "SQLite reconciliation authority");
requireText(read("services/data-core/internal/data/reconciliation_service_test.go"), ["PreviewAndAtomicArtifact", "ControlTotalsUseExactDecimalAccumulation", "RejectsTamperedExpiredAndCancelledExecutionWithoutPartialArtifact", "SELECT COUNT(*) FROM reconciliation_artifacts"], "atomic artifact proof");
requireText(read("services/data-core/internal/data/reconciliation_definition.go"), ["SaveReconciliationDefinition", "ListReconciliationArtifacts", "reconciliation_definitions"], "reviewed reconciliation definition authority");
requireText(read("services/data-core/internal/data/reconciliation_replay.go"), ["enqueueReconciliationDependents", "ProcessReconciliationReplayEvents", "quality-change", "reviewed-replay", "RetryReconciliationReplayEvent", "CancelReconciliationReplayEvent"], "reviewed replay authority");
requireText(read("services/data-core/internal/data/reconciliation_replay_test.go"), ["ReplaysExactlyOnceOnCompatibleSourceVersion", "PausesOnCardinalityControlAndQualityChanges", "RecoversInterruptedRunningState", "RecoveryFailsExhaustedRunningState", "BackupReconciliationDefinitionValidationRejects", "BackupReconciliationReplayValidationRejects"], "replay recovery and backup behavior proof");
requireText(read("services/data-core/internal/data/backup_reconciliation_validation.go"), ["validateBackupReconciliationDefinitions", "validateBackupReconciliationReplayEvents", "mismatched reconciliation replay artifact"], "replay backup integrity");
requireText(read("apps/desktop/src/main/reconciliation-approval-sessions.ts"), ["approvalLifetimeMilliseconds", "consume(token", "pending.delete(token)", "parseReconciliationProposal"], "one-use reconciliation approval");
requireText(read("apps/desktop/src/renderer/ReconciliationDialog.tsx"), ["规范化精确匹配键", "控制总额", "批准并生成 Reconcile Artifact", "未决候选不会自动确认", "复制当前证据", "导出 CSV", "保存为受审下期任务", "长期证据与下期状态", "quality-change"], "Reconcile product flow");
requireText(read("apps/desktop/src/renderer/RecurringWorkCenter.tsx"), ["周期工作中心", "needs-attention", "查看原因", "retryReplay"], "global pending reconciliation entry");
requireText(read("apps/desktop/src/main/reconciliation-replay-scheduler.ts"), ["processReconciliationReplayEvents", "startReconciliationReplayScheduler"], "desktop replay scheduler");
requireText(`${read("apps/desktop/src/main.ts")}\n${read("apps/desktop/src/main/packaged-smoke.ts")}`, ["14-reconcile-sales-refunds.png", "15-reconcile-orders-payments.png", "16-reconcile-reviewed-replay.png", "BUBU_PACKAGED_RECONCILIATION_OK", "完整结果已原子保存", "右侧重复", "受审任务自动重放"], "packaged reconciliation journeys");

if (failures.length) { console.error(`Reconciliation verification failed:\n\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log("Reconciliation verified: strict plans, local reviewed execution, immutable evidence, and recoverable next-version replay.");
