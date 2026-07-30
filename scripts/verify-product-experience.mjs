import { readFileSync } from "node:fs";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";

const failures = [];
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const requireText = (source, values, label) => {
  for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`);
};
const rejectText = (source, values, label) => {
  for (const value of values) if (source.includes(value)) failures.push(`${label} contains stale product claim: ${value}`);
};

const workspace = read("apps/desktop/src/renderer/DatasetWorkspace.tsx");
requireText(read("apps/desktop/src/renderer/app-navigation.ts"), ["reduceAppNavigation", 'type: "open-settings"', 'type: "initialize-catalog"'], "pure application navigation state");
if (workspace.indexOf("<ConversationWorkbench") < workspace.indexOf("<section className=\"dataset-summary\"")) {
  failures.push("dataset conversation workbench must follow the compact entity summary");
}
if (workspace.includes("LOCAL PREVIEW")) failures.push("dataset preview escaped the data-context inspector");

const conversations = read("apps/desktop/src/renderer/ConversationWorkbench.tsx");
requireText(conversations, [
  "workbench-compact-nav",
  "conversations.rename",
  "conversations.list(target, true)",
  "archived: false",
  "thread-undo",
  "compactReturnFocus",
  'event.key === "Escape"',
  "workbench-pane-backdrop",
  "textarea, input, select, button, a, summary",
  "thread-menu-trigger",
  "当前空任务可以直接使用",
  'aria-controls="conversation-artifact-inspector"',
  'toggleCompactPane("workflow"',
  "ContextMenu",
  "查看任务历史",
], "conversation lifecycle");
requireText(read("apps/desktop/src/renderer/App.tsx"), ["DatasetNameDialog", "DatasetVersions", "onContextMenu", "groupEditRequest", '"reconciliation-cases"', '"retail-operations"', '"merge-exports"', 'setDataCleanInitialTemplate("append-exports")'], "data object and business topic actions");
requireText(read("apps/desktop/src/renderer/DatasetWorkspace.tsx"), ["打开零售经营示例", "3 个数据对象 · 2 条已确认关系 · 1 个每周业务主题"], "truthful empty-workspace demo entry");
requireText(read("packages/product-core/src/task-starters.ts"), ['status: "implemented"', 'id: "clean"', 'id: "compare"', 'id: "reconcile"', 'id: "merge"', 'actionLabel: "打开周期导出 Merge"', 'id: "analyze"', 'id: "repeat"'], "truthful empty-workspace task map");
requireText(read("apps/desktop/src/renderer/DatasetWorkspace.tsx"), ["workspace-task-map", "计划中", "尚不可执行", 'task.status === "implemented"'], "non-deceptive task entry rendering");
requireText(read("apps/desktop/src/main/demo-catalog.ts"), ["createDemoWorkspace", "示例工作区只能导入到空白本地工作区", "rollbackErrors", 'column: "Region"', 'column: "Customer ID"', '"merge-exports"', '"第 1 周订单"'], "bounded rollback-safe demo setup");
requireText(read("apps/desktop/src/renderer/McpSettings.tsx"), ["selectExecutable", "选择文件", "mcp-command-guidance"], "guided MCP executable selection");
requireText(read("apps/desktop/src/renderer/ProviderSettings.tsx"), ["保存并测试连接", "provider-test-guidance", "providerPresets", "常用起点"], "provider save, test, and preset flow");
requireText(read("packages/product-core/src/provider-presets.ts"), ["gpt-5.6", "gpt-5.6-terra", "deepseek-v4-flash", "https://api.deepseek.com/", "qwen3:8b"], "editable provider presets");
requireText(read("packages/product-core/src/task-starters.ts"), ["快速概览", "趋势变化", "关联概览", "关联明细"], "implemented task starters");
requireText(read("packages/product-core/src/prompt-templates.ts"), ["builtin:dataset-balanced", "builtin:group-lookup", "builtin:explain-evidence", "builtin:explain-brief", "upsertCustomPromptTemplate", "selectPromptTemplate"], "pure prompt template policy");
requireText(read("apps/desktop/src/renderer/PromptTemplateSettings.tsx"), ["分析与输出模板", "新建自定义模板", "处理模板", "输出模板", "表达偏好", "不能增加字段、SQL、数据披露或执行权限", "保存并设为当前"], "custom prompt template settings");
requireText(read("apps/desktop/src/renderer/PromptTemplateSelector.tsx"), ["分析模板", "输出模板", "choosePromptTemplate"], "task and output prompt template selection");
requireText(read("apps/desktop/src/renderer/AggregateExplanationPanel.tsx"), ['currentPromptTemplate("aggregate-explanation")', 'scope="aggregate-explanation"'], "aggregate explanation output template selection");
requireText(read("apps/desktop/src/renderer/AggregateDisclosurePreview.tsx"), ["输出模板", "proposal.promptTemplate.name"], "approval-bound output template preview");
requireText(read("apps/desktop/src/renderer/ResultFollowups.tsx"), ["可选下一步", "AggregateExplanationPanel", "AggregateAgentPanel"], "progressive result followups");
requireText(read("apps/desktop/src/renderer/ArtifactInspector.tsx"), ["保存为数据对象", "materializeDerived", "保留全部上游版本和计划指纹"], "explicit derived-object materialization");
requireText(read("apps/desktop/src/renderer/DatasetLineagePanel.tsx"), ["派生关系", "用当前上游版本重算", "planFingerprint", "不可变新版本"], "derived-object lineage and recompute");
requireText(read("apps/desktop/src/renderer/DatasetLineagePanel.tsx"), ["版本执行证据", "一次性审查批准", "已审查计划重放", "质量门禁通过", "完成质量证明", "policyFingerprint", "executionId", "affectedRowCount"], "visible versioned Clean evidence");
requireText(read("apps/desktop/src/renderer/DataCleanDialog.tsx"), ["完成质量门禁", "阻断创建", "允许创建并保留警告", "质量门禁未通过", "先修复阻断项"], "reviewed Clean quality gate");
requireText(read("apps/desktop/src/renderer/DataCleanDialog.tsx"), ["预览影响", "执行前审查", "只能使用一次", "批准并创建数据对象", "dismissDataClean", "affectedRowCount"], "reviewed Data Clean product flow");
requireText(read("packages/product-core/src/data-clean-templates.ts"), ["monthly-prep", "customer-dedup", "order-normalization", "append-exports", "reference-mapping"], "bounded editable Clean templates");
requireText(read("apps/desktop/src/renderer/DataCleanDialog.tsx"), ["选择可复用模板", "第二数据来源", "参考对象匹配键", "relationship-coverage", "固定来源（", "data-clean-fixed-sources", "rowDeltaLabel"], "multi-source Clean template builder and review");
requireText(read("apps/desktop/src/renderer/DatasetLineagePanel.tsx"), ["本地自动重算", "质量门禁阻断", "列结构发生变化", "retryRecompute", "cancelRecompute"], "derived recompute task and remediation surface");
requireText(read("packages/product-core/src/recurring-work.ts"), ["deriveRecurringWorkItems", '"waiting-file"', '"needs-attention"', "latestBy", "recoverable"], "pure recurring work aggregation");
requireText(read("packages/product-core/src/recurring-work.test.ts"), ["deduplicates each durable task", "orders actionable work first", "bounded attempt limit"], "recurring work behavior proof");
requireText(read("apps/desktop/src/renderer/RecurringWorkCenter.tsx"), ["周期工作中心", "等待新文件", "需要处理", "按原定义重试", "不创建新的执行调度器", "retryRecompute", "retryReplay"], "unified recurring work center");
requireText(read("packages/contracts/src/file-arrival.ts"), ["fileArrivalStateSchema", "fileArrivalApprovalSchema", "file name must not contain a path", "schema-profile"], "versioned file-arrival contract");
requireText(read("packages/product-core/src/file-arrival.ts"), ["recommendFileArrivalTargets", "exactSchema", "rowCount", "schema-profile"], "pure file-arrival target policy");
requireText(read("services/data-core/internal/data/replacement.go"), ["InspectSource", "NormalizeHeaders", "inspect source rows"], "authoritative read-only source inspection");
requireText(read("apps/desktop/src/main/file-arrival-store.ts"), ["approved folder", "sha256", "changed after detection", "slice(0, 100)", "onDetected"], "private durable file-arrival store");
requireText(read("apps/desktop/src/renderer/RecurringWorkCenter.tsx"), ["批准周期文件夹", "历史来源一致", "确认并创建版本", "列结构发生变化", "不会向界面暴露完整路径"], "reviewed file-arrival product flow");
const reportContract = read("packages/contracts/src/report-bundle.ts");
requireText(reportContract, ["reportBundleInputSchema", 'kind: z.enum(["clean", "reconciliation", "analysis"])', "modelNarrative", "reportBundleExportResultSchema"], "professional report contract");
requireText(read("apps/desktop/src/main/report-bundle.ts"), ["reportHtml", "reportWorkbook", "workbookStyles", "showGridLines", "autoFilter", "overflow-wrap:anywhere", "repeat(auto-fit,minmax(220px,1fr))", "manifest.json", "sha256", "mkdtemp", "rename(temporary, target)"], "deterministic atomic professional report bundle");
requireText(read("apps/desktop/src/main/artifact-api.ts"), ["renderReportPdf", "printToPDF", "writeReportBundle", "openDirectory"], "offline PDF report adapter");
requireText(read("apps/desktop/src/renderer/DatasetLineagePanel.tsx"), ["exportCleanReport", "Clean 专业报告包", "质量策略指纹"], "Clean professional report entry");
requireText(read("apps/desktop/src/renderer/ReconciliationDialog.tsx"), ["exportReportBundle", "导出专业报告包", "计划指纹", "控制总额"], "Reconcile professional report entry");
requireText(read("scripts/smoke-packaged-desktop.mjs"), ["BUBU_PACKAGED_MERGE_OK", "BUBU_PACKAGED_FILE_ARRIVAL_OK", "BUBU_PACKAGED_PROFESSIONAL_REPORT_OK"], "packaged V1 closure evidence");
const closureGuide = read("docs/product/file-arrivals-and-professional-reports.md");
requireText(closureGuide, ["Approved local folder arrivals", "read-only source inspection", "Professional evidence bundles", "report.pdf", "report.xlsx", "frozen headers", "adaptive columns", "wrapped long identifiers", "manifest.json", "SHA-256", "non-authoritative"], "current file arrival and report guide");
const queryingGuide = read("docs/product/querying-and-visualizations.md");
requireText(queryingGuide, ["enqueues every active dependent derived object exactly once", "five editable local templates", "automatically replay the stored plan and policy"], "current recurring Clean product guide");
rejectText(queryingGuide, ["Automatic derived-object recompute is still planned", "templates remain planned for P1.7", "Automatic recompute remains P1.5"], "current recurring Clean product guide");
const experienceBlueprint = read("docs/product/experience-blueprint.md");
requireText(experienceBlueprint, ["Completed recurring-work vertical slice", "The recurring Clean expansion is also implemented", "Compare/Reconcile now has a complete local product core", "saved as a reviewed next-period task", "privacy-safe global pending entry", "All six tasks are executable", "Merge imports three same-schema weekly exports"], "current product experience blueprint");
rejectText(experienceBlueprint, ["The next transformation expansion is typed select/rename/cast/derive/union and automatic recompute delivery", "Compare, Reconcile, and Merge are visibly marked **计划中**", "Merge remains **计划中**", "only Merge is visibly marked **计划中**"], "current product experience blueprint");
const closurePlan = read("docs/strategy/2026-07-27-product-closure-and-reconcile-execution-plan.md");
requireText(closurePlan, ["[x] P1.3 完成证据型 Artifact", "[x] P1.4 完成源版本触发的幂等重放", "[x] P2.1 完成不引入第二调度器", "[x] P2.2 完成本地文件到达识别", "[x] P2.3 完成 Clean/Reconcile 专业报告 bundle", "[ ] P0.3 附着真实签名"], "current product closure checklist");
rejectText(closurePlan, ["[ ] P1.3 完成保存受审规则与 Artifact 长期入口"], "current product closure checklist");
const exportGuide = read("docs/product/exporting-and-deleting.md");
requireText(exportGuide, ["Dataset deletion and permanent archived-task deletion are irreversible", "any workflow evidence reference blocks deletion", "optional retention policy defaults off", "Backup and restore do not turn deletion into an undo action"], "current export and deletion guide");
rejectText(exportGuide, ["Backup/recovery and retention policy are separate Stage 2 capabilities"], "current export and deletion guide");
const privacyGuide = read("docs/architecture/privacy-and-model-providers.md");
requireText(privacyGuide, ["The end-to-end privacy gateway for every currently executable model path is implemented", "Future scheduled-Agent or richer retrieval paths must add their own enforcement", "Strict private mode and local DLP", "cannot disable local DLP", "Main repeats enforcement", "Explicit-row disclosure approval", "Raw rows remain zero by default", "Strict-private mode always rejects this path", "local knowledge chunk approvals"], "current privacy gateway guide");
rejectText(privacyGuide, ["the end-to-end privacy gateway remains `in-progress`", "explicit-row disclosure remain in progress"], "current privacy gateway guide");
requireText(read("packages/product-core/src/privacy-policy.ts"), ["inspectPrivacyText", "pasted-table", "government-id", "parsePrivacyTextInspection"], "pure local DLP policy");
requireText(read("apps/desktop/src/main/privacy-policy-store.ts"), ["strict-private", "schema-only", "assertModelTextAllowed", "atomicPrivateWrite"], "main-owned strict privacy policy");
requireText(read("apps/desktop/src/main/analysis-api.ts"), ["privacyPolicy.assertModelTextAllowed", "privacyPolicy.disclosureFor"], "model-entry DLP enforcement");
requireText(read("apps/desktop/src/renderer/DataProtectionPanel.tsx"), ["严格隐私模式", "本地 DLP 不可关闭", "远程模型仅使用 Schema"], "strict privacy product control");
requireText(read("packages/contracts/src/explicit-row-disclosure.ts"), ["maximumExplicitRowPayloadBytes", "Wildcard columns are not allowed", "Row numbers must be unique", "Evidence must reference an explicitly disclosed cell"], "explicit-row versioned contract");
requireText(read("packages/product-core/src/explicit-row-disclosure.ts"), ["explicitRowDisclosureFacts", "fingerprintPrefix", "cellCount"], "explicit-row pure approval facts");
requireText(read("apps/desktop/src/main/explicit-row-api.ts"), ["assertExplicitRowsAllowed", "approvals.consume", "payloadSha256", 'purpose: "explicit-row-explanation"', 'disclosure: "explicit-rows"'], "explicit-row audited desktop path");
requireText(read("apps/desktop/src/renderer/ExplicitRowDisclosurePanel.tsx"), ["默认 0 行", "逐行、逐列选择", "批准这一次精确披露", "第 ${rowNumber} 行 · ${column}"], "explicit-row review and cited result UI");
requireText(read("scripts/smoke-packaged-desktop.mjs"), ["BUBU_PACKAGED_EXPLICIT_ROWS_OK"], "packaged explicit-row journey");
requireText(read("packages/contracts/src/agent-definition.ts"), ["agentDefinitionRegistrySchema", ".max(24)", "Agent definition IDs must be unique"], "reusable Agent definition contract");
requireText(read("apps/desktop/src/main/agent-definition-store.ts"), ["atomicPrivateWrite", "preparePrivateDirectory", "Agent definition limit reached", "Agent definition does not exist"], "private reusable Agent definition store");
requireText(read("apps/desktop/src/main/desktop-api.ts"), ["parseAgentDefinitionSaveInput", "privacyPolicy.assertModelTextAllowed(input.goal)", "listAgentDefinitions", "removeAgentDefinition"], "Agent definition desktop boundary");
requireText(read("apps/desktop/src/renderer/AggregateAgentPanel.tsx"), ["可复用定义", "另存新定义", "保存当前目标", "更新定义", "历史运行证据保持不变", "运行时仍需审查数据、模型与固定预算"], "reusable bounded Agent product flow");
const workflowGuide = read("docs/product/repeatable-workflows.md");
requireText(workflowGuide, ["complete currently exposed deterministic workflow product", "Human approval and safe resume", "waiting for a person is durable state", "definition version, durable run, node ordinal and ID", "Startup recovery excludes runs whose active node has a matching pending approval", "Scheduled/background Agent steps"], "current workflow guide");
rejectText(workflowGuide, ["`workflows`, `bounded-agents`, and `reminders` stay `in-progress`"], "current workflow guide");
requireText(read("packages/contracts/src/workflow.ts"), ['z.literal("human-approval")', '"awaiting-approval"', "workflowApprovalRequestSchema", "workflowApprovalDecisionInputSchema"], "versioned workflow approval contract");
requireText(read("packages/product-core/src/workflow-approval.ts"), ["expireWorkflowApproval", "resolveWorkflowApproval", "workflowApprovalFacts", "Workflow definition changed after approval was requested"], "pure workflow approval state machine");
requireText(read("services/data-core/internal/data/workflow_approval.go"), ["pauseWorkflowForApproval", "DecideWorkflowApproval", "expireWorkflowApprovals", "workflow definition changed after approval was requested"], "durable workflow approval authority");
requireText(read("apps/desktop/src/renderer/WorkflowPanel.tsx"), ["交付前必须人工批准", "等待人工批准", "批准并恢复同一运行", "拒绝并终止"], "workflow approval UI");
requireText(read("scripts/smoke-packaged-desktop.mjs"), ["BUBU_PACKAGED_WORKFLOW_APPROVAL_OK"], "packaged workflow approval journey");
requireText(read("apps/desktop/src/main/data-clean-approval-sessions.ts"), ["approvalLifetimeMilliseconds", "consume(token", "pending.delete(token)", "parseDataCleanProposal"], "one-use Data Clean approval");
requireText(read("apps/desktop/src/main/desktop-api.ts"), ["prepareDataClean", "approveDataClean", "Data Clean 必须先预览影响并使用一次性批准执行"], "Data Clean desktop enforcement");
requireText(read("apps/desktop/src/renderer/DatasetGroupWorkspace.tsx"), ["cadence-picker", '"dataset-version"', "workflowCadence={group.cadence}"], "business topic cadence");
requireText(read("apps/desktop/src/renderer/WorkflowPanel.tsx"), ["workflow-graph", "graphMode", "保存为工作流", "workflows.runs", 'value="monthly"', "scheduleDescription", "triggerFromSchedule", "workflow-row-main"], "workflow graph and finalization");
if (read("apps/desktop/src/renderer/DatasetAnalysis.tsx").includes("请先在左侧") || read("apps/desktop/src/renderer/DatasetGroupAnalysis.tsx").includes("请先在左侧")) {
  failures.push("empty task guidance must not reference a pane that adaptive layout can hide");
}
const chatMessages = read("apps/desktop/src/renderer/ChatMessage.tsx");
requireText(chatMessages, [
  "chat-message-user",
  "chat-tool-event",
  "chat-message-assistant",
  "chat-message-recovery",
  'role="alert"',
], "semantic chat messages");
for (const path of ["apps/desktop/src/renderer/DatasetAnalysis.tsx", "apps/desktop/src/renderer/DatasetGroupAnalysis.tsx", "apps/desktop/src/renderer/ConversationHistory.tsx"]) {
  const source = read(path);
  if (/PRIVACY-SAFE DATA CHAT|PRIVATE MULTI-TABLE CHAT|LOCAL CONVERSATION HISTORY|REVIEW BEFORE EXECUTION|REVIEW JOIN TREE|LOCAL QUERY RESULT|LOCAL JOIN RESULT/u.test(source)) {
    failures.push(`${path} contains decorative English chat hierarchy`);
  }
  if (!source.includes("rows.slice(0, 5)")) failures.push(`${path} must keep result previews bounded to five rows`);
}
const taskLifecycle = read("apps/desktop/src/renderer/task-lifecycle.ts");
requireText(taskLifecycle, [
  '"draft"',
  '"awaiting-approval"',
  '"needs-attention"',
  '"cancelled"',
  "derivePersistedTaskState",
  "latestTaskSnapshot",
  "A persisted question without its following plan",
], "task lifecycle");

const artifacts = read("apps/desktop/src/renderer/ArtifactInspector.tsx");
requireText(artifacts, [
  'type InspectorTab = "summary" | "data" | "visual" | "evidence"',
  'role="tablist"',
  'role="tabpanel"',
  "ArrowLeft",
  "artifact-shell-expanded",
  "WorkflowPanel target={target} threadId={threadId}",
  "copyTable(actionInput)",
  "exportTable(actionInput)",
  "pinnedArtifactKey",
  "exportReport",
  "latestTaskSnapshot",
  "artifact-empty-state",
  'aria-sort={direction}',
], "artifact workbench");
requireText(`${read("apps/desktop/src/main.ts")}\n${read("apps/desktop/src/main/packaged-smoke.ts")}`, ["04-artifact.png", "05-workflow.png", "06-derived-object.png", "07-lineage.png", "08-output-templates.png", "09-retail-demo.png", "10-data-clean-templates.png", "10-data-clean-review.png", "11-data-clean-result.png", "12-recurring-quality-pause.png", "13-recurring-remediated.png", "14-reconcile-sales-refunds.png", "15-reconcile-orders-payments.png", "16-reconcile-reviewed-replay.png", "17-recurring-work-center.png", "19-merge-result.png", "smoke-derived-summary", "smoke-data-clean", "Smoke 输出模板", "五个 Clean 模板", "动态工作流节点图", "layout.scrollLeft === 0", "版本 2", "用示例开始 Clean", "打开周期导出 Merge", "追加兼容数据", "结果抽屉或图表超出工作台", "inspector.getAnimations()", "inspectorScrollWidth - measurements.inspectorClientWidth", "BUBU_PACKAGED_RETAIL_DEMO_OK", "BUBU_PACKAGED_MERGE_OK", "BUBU_PACKAGED_RECURRING_CLEAN_OK", "BUBU_PACKAGED_RECONCILIATION_OK", "BUBU_PACKAGED_AGENT_DEFINITION_OK", "BUBU_PACKAGED_REPORT_COMPOSITION_OK", "BUBU_PACKAGED_VISUALIZATION_PREFERENCE_OK", "useContentSize: true"], "settled packaged Artifact evidence");
const artifactBoundary = read("apps/desktop/src/main/artifact-api.ts");
requireText(artifactBoundary, ["parseArtifactTableActionInput", "clipboard.writeText", "showSaveDialog", "artifactCsv", "artifactTsv", "artifactHtmlReport"], "artifact desktop boundary");
const visualization = read("packages/contracts/src/visualization.ts");
requireText(visualization, ["recommendVisualization", "composeVisualizations", "visualizationCompositionSchema", ".max(4)", "未经计划批准的聚合", "完整表格比截断后的多图组合更可信", "toSorted"], "deterministic visualization suitability and composition");
requireText(read("apps/desktop/src/renderer/ResultVisualization.tsx"), ["建议保留表格", "chart-data-alternative", "visualization-switcher", "切换受审数值指标", "recommendation.reason"], "accessible visualization composition");
requireText(read("apps/desktop/src/renderer/visualization-preferences.ts"), ["maximumPreferences = 24", "visualizationSchemaSignature", "preferredVisualizationMetric", "savePreferredVisualizationMetric", "valueLabel"], "bounded local visualization preferences");
requireText(read("apps/desktop/src/renderer/ArtifactInspector.tsx"), ["组合专业报告", "报告组成", "每个安全可视化的独立数据 Sheet", "受审计划血缘", "运行元数据", "限制与截断说明", "生成专业报告包", "composeVisualizations"], "configurable professional report composition");

const styles = read("apps/desktop/src/renderer/styles.css");
requireText(styles, [
  "body { margin: 0; min-width: 0; min-height: 640px; }",
  "container: workbench / inline-size",
  "@container workbench (max-width: 1180px)",
  "@container workbench (max-width: 760px)",
  "compact-threads-open",
  "compact-artifacts-open",
  "workbench-pane-backdrop",
  ".artifact-header > div:first-child { min-width: 0; }",
  "width: min(520px, calc(100% - 48px))",
  "@media (prefers-reduced-motion: reduce)",
  "--focus-ring",
], "responsive and accessible styling");

const decorativeEnglish = [
  "LOCAL DATA AGENT",
  "DATA GROUPS",
  "PRIVATE BY DEFAULT",
  "LOCAL GROUP WORKSPACE",
  "SECURE LOCAL CONFIG",
  "LOCAL VISUALIZATION",
  "MODEL REGISTRY",
  "REPEATABLE LOCAL AUTOMATION",
  "APPROVED AGGREGATE INSIGHT",
  "BOUNDED AGENT REPORT",
];
for (const path of [
  "apps/desktop/src/renderer/App.tsx",
  "apps/desktop/src/renderer/ResultVisualization.tsx",
  "apps/desktop/src/renderer/ProviderSettings.tsx",
  "apps/desktop/src/renderer/WorkflowPanel.tsx",
  "apps/desktop/src/renderer/AggregateExplanationCard.tsx",
  "apps/desktop/src/renderer/AggregateAgentCard.tsx",
]) {
  const source = read(path);
  for (const marker of decorativeEnglish) if (source.includes(marker)) failures.push(`${path} contains decorative English hierarchy: ${marker}`);
}

for (const path of [
  "apps/desktop/src/renderer/App.tsx",
  "apps/desktop/src/renderer/DatasetWorkspace.tsx",
  "apps/desktop/src/renderer/DatasetAnalysis.tsx",
  "apps/desktop/src/renderer/DatasetGroupAnalysis.tsx",
  "apps/desktop/src/renderer/DatasetGroupWorkspace.tsx",
  "apps/desktop/src/renderer/DatasetNameDialog.tsx",
  "apps/desktop/src/renderer/ProviderSettings.tsx",
]) {
  const source = read(path);
  if (source.includes("数据联系人") || source.includes("数据群组")) failures.push(`${path} contains retired product terminology`);
}

requireText(read("docs/product/experience-blueprint.md"), [
  "file -> data object -> immutable version",
  "Intent, authority, and evidence stay separate",
  "Product function map",
  "Derived objects",
  "Completed recurring-work vertical slice",
], "first-principles product experience blueprint");

const workflowContract = read("packages/contracts/src/workflow.ts");
const workflowDelivery = read("services/data-core/internal/data/workflow_trigger_finish.go");
requireText(workflowContract, ["threadId: workflowIdSchema"], "workflow contract");
requireText(workflowDelivery, ["definitions.thread_id", "appendConversationEntryToThread"], "workflow delivery");
requireText(workflowContract, ['kind: z.literal("calendar")', "timeZone", '"calendar"'], "calendar workflow contract");
requireText(read("apps/desktop/src/main/workflow-trigger-scheduler.ts"), ["onFinished", "finishWorkflowTrigger"], "workflow completion callback");
requireText(read("apps/desktop/src/main.ts"), ["Notification.isSupported", "BuBu 工作流提醒"], "privacy-safe workflow notification");
requireText(read("apps/desktop/src/main/derived-recompute-scheduler.ts"), ["processDerivedRecomputeEvents", "onFinished", "AUTOMATION_POLL_INTERVAL_MILLISECONDS"], "derived recompute desktop poller");
requireText(read("apps/desktop/src/main.ts"), ["BuBu 自动重算", "已暂停自动重算", "startDerivedRecomputeScheduler"], "privacy-safe derived recompute notification");
requireText(read("apps/desktop/src/renderer/ChatMessage.tsx"), ["导出本次结果 CSV", "exportTable", "不会发送给模型"], "chat result export");

const settings = read("apps/desktop/src/renderer/SettingsHealthOverview.tsx");
requireText(settings, ["deriveSettingsHealth", "settings-findings", "重新检查", "navigateToFinding(finding.section)", "Promise.allSettled"], "settings health");
requireText(read("apps/desktop/src/renderer/settings-health.ts"), ["blocker", "action", "optional", "ready", "diagnostics", "系统加密不可用", "需要选择当前模型"], "settings diagnostic policy");
requireText(read("apps/desktop/src/renderer/App.tsx"), ['aria-current={settingsSection === "models"', "settings-content-context"], "settings list detail navigation");

const manifest = loadProductManifest(new URL("..", import.meta.url));
requireManifestFacts(manifest, [
  "deterministic-workflow-thread-delivery: implemented",
  "persisted-conversation-task-resume: implemented",
  "expandable-artifact-workspace: implemented",
  "compact-conversation-drawers: implemented",
  "adaptive-conversation-panes: implemented",
  "semantic-chat-message-grammar: implemented",
  "typed-conversation-task-lifecycle: implemented",
  "interrupted-task-recovery: implemented",
  "cancellation-aware-task-state: implemented",
  "latest-task-turn-isolation: implemented",
  "non-duplicated-task-resume: implemented",
  "artifact-current-view-copy: implemented",
  "artifact-current-view-csv-export: implemented",
  "local-artifact-pinning: implemented",
  "chat-to-artifact-navigation: implemented",
  "deterministic-chart-suitability: implemented",
  "accessible-chart-data-alternative: implemented",
  "bounded-local-html-report: implemented",
  "approved-local-folder-file-arrivals: implemented",
  "data-core-source-inspection: implemented",
  "schema-profile-arrival-target-recommendation: implemented",
  "packaged-file-arrival-journey: implemented",
  "atomic-professional-report-bundles: implemented",
  "offline-html-pdf-report: implemented",
  "multi-sheet-xlsx-report: implemented",
  "machine-readable-report-manifest: implemented",
  "clean-professional-report-bundle: implemented",
  "reconciliation-professional-report-bundle: implemented",
  "packaged-professional-report-journey: implemented",
  "v1-cycle-local-product-metrics: implemented",
  "reports: implemented",
  "workflows: implemented",
  "advanced-workflow-approval-nodes: implemented",
  "definition-bound-workflow-approval-resume: implemented",
  "restart-preserved-workflow-approvals: implemented",
  "packaged-workflow-approval-journey: implemented",
  "bounded-agents: implemented",
  "reusable-bounded-agent-definitions: implemented",
  "packaged-agent-definition-journey: implemented",
  "mcp-host: implemented",
  "reminders: implemented",
  "rich-visualization-composition: implemented",
  "packaged-visualization-preference-journey: implemented",
  "rich-report-composition: implemented",
  "packaged-report-composition-journey: implemented",
  "actionable-settings-health: implemented",
  "refreshable-settings-diagnostics: implemented",
  "fail-closed-settings-diagnostics: implemented",
  "settings-section-scroll-restoration: implemented",
  "settings-list-detail-navigation: implemented",
  "keyboard-managed-compact-panels: implemented",
  "keyboard-complete-context-menus: implemented",
  "artifact-tab-keyboard-navigation: implemented",
  "privacy-preserving-local-product-metrics: implemented",
  "strict-private-mode: implemented",
  "local-dlp: implemented",
  "explicit-raw-row-disclosure: implemented",
  "product-metrics-content-verifier: implemented",
  "compact-entity-context-bar: implemented",
  "direct-empty-task-actions: implemented",
  "duplicate-empty-task-guard: implemented",
  "intentional-artifact-drawer: implemented",
  "custom-dataset-display-names: implemented",
  "dataset-version-history-popover: implemented",
  "business-topic-group-cadence: implemented",
  "conversation-context-menus: implemented",
  "top-right-history-result-workflow-controls: implemented",
  "static-dynamic-workflow-graph: implemented",
  "conversation-workflow-finalization: implemented",
  "calendar-workflow-triggers: implemented",
  "configurable-calendar-workflow-schedules: implemented",
  "os-workflow-notifications: implemented",
  "chat-result-csv-export: implemented",
  "provider-save-and-test: implemented",
  "provider-configuration-presets: implemented",
  "deepseek-openai-compatible-preset: implemented",
  "editable-task-starter-prompts: implemented",
  "progressive-result-followups: implemented",
  "canonical-data-object-language: implemented",
  "pure-product-core-package: implemented",
  "versioned-custom-prompt-templates: implemented",
  "prompt-template-task-selection: implemented",
  "custom-output-prompt-templates: implemented",
  "approval-bound-output-prompt-selection: implemented",
  "packaged-output-template-journey: implemented",
  "bundled-retail-demo-workspace: implemented",
  "demo-relationship-and-topic-setup: implemented",
  "rollback-safe-demo-setup: implemented",
  "packaged-retail-demo-journey: implemented",
  "typed-derived-transformation-plans: implemented",
  "typed-data-clean-plan-grammar: implemented",
  "deterministic-data-clean-kernel: implemented",
  "data-clean-immutable-recompute: implemented",
  "data-clean-impact-preview: implemented",
  "data-clean-product-flow: implemented",
  "approval-bound-data-clean-materialization: implemented",
  "versioned-data-clean-execution-evidence: implemented",
  "packaged-data-clean-evidence-journey: implemented",
  "materialized-derived-data-objects: implemented",
  "immutable-derived-object-recompute: implemented",
  "version-level-data-lineage: implemented",
  "chained-derived-data-objects: implemented",
  "packaged-derived-recompute-journey: implemented",
  "chained-derived-object-regression: implemented",
  "automatic-derived-object-recompute: implemented",
  "fail-closed-derived-dependency-graph: implemented",
  "idempotent-derived-recompute-queue: implemented",
  "topological-downstream-recompute: implemented",
  "restart-recovered-derived-recompute: implemented",
  "derived-recompute-retry-and-cancel: implemented",
  "derived-recompute-quality-and-drift-pause: implemented",
  "derived-recompute-task-delivery: implemented",
  "privacy-safe-derived-recompute-notifications: implemented",
  "editable-data-clean-template-catalog: implemented",
  "multi-source-data-clean-templates: implemented",
  "packaged-recurring-clean-remediation-journey: implemented",
  "native-mcp-executable-picker: implemented",
  "conversation-retention-and-deletion: implemented",
  "bounded-conversation-history-pagination: implemented",
  "packaged-conversation-retention-journey: implemented",
  "configuration-backup-and-restore: implemented",
  "packaged-configuration-backup-journey: implemented",
  "postgresql-hub-integration-evidence: implemented",
  "lightweight-onboarding-checklist: implemented",
  "structure-driven-task-recommendation: implemented",
  "packaged-onboarding-journey: implemented",
  "signed-automatic-updates-and-rollback: planned",
  "bounded-retention-backlog-catch-up: implemented",
  "two-phase-configuration-restore-rollback: implemented",
  "schema-only-evidence-bound-onboarding: implemented",
  "consented-design-partner-pilot-evidence: planned",
], failures, "product manifest");

requireText(queryingGuide, ["Explicit-row disclosure is implemented", "Archived-task deletion and an optional bounded retention policy are implemented"], "querying capability truth");
rejectText(queryingGuide, ["Explicit-row disclosure and automated retention controls remain incomplete"], "querying capability truth");
const conversationGuide = read("docs/architecture/local-conversations.md");
requireText(conversationGuide, ["multiple bounded named local conversation threads", "does not synchronize conversations or raw rows", "permanently delete an exact archived task", "30–3,650 day policy", "portable configuration backup is implemented", "Bounded local pagination beyond the latest 500 entries is implemented"], "conversation capability truth");
rejectText(conversationGuide, ["Multiple named threads per contact", "exports, saved report artifacts"], "conversation capability truth");
requireText(read("apps/desktop/src/renderer/ConversationHistory.tsx"), ["加载更早记录", "conversations.page", "limit: 100"], "conversation pagination UI");
const backupGuide = read("docs/product/backup-and-recovery.md");
requireText(backupGuide, ["Portable product-setting backup is implemented", ".bubu-settings", "structurally excludes datasets, credentials", "must be recreated and authorized", "one-use two-phase transaction", "automatically rolls back after 30 seconds"], "transactional backup scope truth");
requireText(read("docs/strategy/README.md"), ["2026-07-29-v1-final-closure-onboarding-and-validation-plan.md", "这是当前执行合同"], "current execution plan routing");
requireText(read("apps/desktop/src/main/conversation-retention-store.ts"), ["enabled: false", "retentionDays: 90", "atomicPrivateWrite"], "private conversation retention policy");
requireText(read("services/data-core/internal/data/conversation_threads.go"), ["conversation must be archived before permanent deletion", "conversation changed after deletion review", "conversation is retained by workflow evidence", "ApplyConversationRetention", "maximumConversationRetentionBatch"], "authoritative conversation lifecycle");
requireText(read("apps/desktop/src/renderer/ConversationWorkbench.tsx"), ["输入完整任务名称确认", "有关联工作流证据时会拒绝删除", "永久删除归档任务"], "conversation deletion UI");
requireText(read("apps/desktop/src/renderer/DataProtectionPanel.tsx"), ["归档任务保留", "默认不自动删除", "保存保留策略"], "conversation retention UI");
requireText(read("apps/desktop/src/main/packaged-smoke.ts"), ["BUBU_PACKAGED_CONVERSATION_RETENTION_OK"], "packaged conversation lifecycle");
requireText(read("packages/contracts/src/configuration-backup.ts"), ["configurationBackupBundleSchema", "credentials", "hub-and-webhook-connections"], "portable configuration contract");
requireText(read("apps/desktop/src/main/configuration-backup-service.ts"), ["maximumConfigurationBytes", "parseConfigurationBackupBundle", "atomicPrivateWrite"], "portable configuration boundary");
requireText(read("apps/desktop/src/renderer/OnboardingChecklist.tsx"), ["用真实结构决定第一步", "datasets.structure", "不读取任何数据行", "暂时隐藏", "重试读取"], "schema-only recoverable onboarding UI");
requireText(read("packages/product-core/src/onboarding.ts"), ["recommendFirstTask", "hasPeriodicEvidence", "共同字段不等于业务关系", 'kind: "create-topic"'], "evidence-bound first task policy");
requireText(read("apps/desktop/src/main/packaged-smoke.ts"), ["BUBU_PACKAGED_CONFIGURATION_BACKUP_OK", "BUBU_PACKAGED_ONBOARDING_OK", "BUBU_PACKAGED_ACCESSIBILITY_OK"], "packaged configuration, onboarding, and accessibility evidence");

if (failures.length > 0) {
  console.error(`Product experience verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Product experience verified: conversation-first hierarchy, thread ownership, artifacts, settings, accessibility, and compact reflow are aligned.");
