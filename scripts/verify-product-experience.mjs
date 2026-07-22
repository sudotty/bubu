import { readFileSync } from "node:fs";

const failures = [];
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const requireText = (source, values, label) => {
  for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`);
};

const workspace = read("apps/desktop/src/renderer/DatasetWorkspace.tsx");
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
  'aria-controls="conversation-artifact-inspector"',
  'toggleCompactPane("workflow"',
  "ContextMenu",
  "查看任务历史",
], "conversation lifecycle");
requireText(read("apps/desktop/src/renderer/App.tsx"), ["DatasetNameDialog", "DatasetVersions", "onContextMenu", "groupEditRequest"], "data object and business topic actions");
requireText(read("apps/desktop/src/renderer/DatasetGroupWorkspace.tsx"), ["cadence-picker", '"dataset-version"', "workflowCadence={group.cadence}"], "business topic cadence");
requireText(read("apps/desktop/src/renderer/WorkflowPanel.tsx"), ["workflow-graph", "graphMode", "收尾为工作流", "workflows.runs", 'value="monthly"'], "workflow graph and finalization");
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
], "artifact workbench");
requireText(read("apps/desktop/src/main.ts"), ["04-artifact.png", "05-workflow.png", "动态工作流节点图", "结果抽屉或图表超出工作台", "inspector.getAnimations()", "inspectorScrollWidth - measurements.inspectorClientWidth", "useContentSize: true"], "settled packaged Artifact evidence");
const artifactBoundary = read("apps/desktop/src/main/artifact-api.ts");
requireText(artifactBoundary, ["parseArtifactTableActionInput", "clipboard.writeText", "showSaveDialog", "artifactCsv", "artifactTsv", "artifactHtmlReport"], "artifact desktop boundary");
const visualization = read("packages/contracts/src/visualization.ts");
requireText(visualization, ["recommendVisualization", "未经计划批准的聚合", "共有 ${points.length} 个分类", "toSorted"], "deterministic visualization suitability");
requireText(read("apps/desktop/src/renderer/ResultVisualization.tsx"), ["建议保留表格", "chart-data-alternative", "recommendation.reason"], "accessible visualization");

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

const workflowContract = read("packages/contracts/src/workflow.ts");
const workflowDelivery = read("services/data-core/internal/data/workflow_trigger_finish.go");
requireText(workflowContract, ["threadId: workflowIdSchema"], "workflow contract");
requireText(workflowDelivery, ["definitions.thread_id", "appendConversationEntryToThread"], "workflow delivery");
requireText(workflowContract, ['kind: z.literal("calendar")', "timeZone", '"calendar"'], "calendar workflow contract");
requireText(read("apps/desktop/src/main/workflow-trigger-scheduler.ts"), ["onFinished", "finishWorkflowTrigger"], "workflow completion callback");
requireText(read("apps/desktop/src/main.ts"), ["Notification.isSupported", "BuBu 工作流提醒"], "privacy-safe workflow notification");
requireText(read("apps/desktop/src/renderer/ChatMessage.tsx"), ["导出本次结果 CSV", "exportTable", "不会发送给模型"], "chat result export");

const settings = read("apps/desktop/src/renderer/SettingsHealthOverview.tsx");
requireText(settings, ["deriveSettingsHealth", "settings-findings", "重新检查", "navigateToFinding(finding.section)"], "settings health");
requireText(read("apps/desktop/src/renderer/settings-health.ts"), ["blocker", "action", "optional", "ready", "系统加密不可用", "需要选择当前模型"], "settings diagnostic policy");
requireText(read("apps/desktop/src/renderer/App.tsx"), ['aria-current={settingsSection === "models"', "settings-content-context"], "settings list detail navigation");

const manifest = read("PRODUCT_MANIFEST.yaml");
requireText(manifest, [
  "deterministic-workflow-thread-delivery: implemented",
  "persisted-conversation-task-resume: implemented",
  "expandable-artifact-workspace: implemented",
  "compact-conversation-drawers: implemented",
  "adaptive-conversation-panes: implemented",
  "semantic-chat-message-grammar: implemented",
  "typed-conversation-task-lifecycle: implemented",
  "interrupted-task-recovery: implemented",
  "cancellation-aware-task-state: implemented",
  "artifact-current-view-copy: implemented",
  "artifact-current-view-csv-export: implemented",
  "local-artifact-pinning: implemented",
  "chat-to-artifact-navigation: implemented",
  "deterministic-chart-suitability: implemented",
  "accessible-chart-data-alternative: implemented",
  "bounded-local-html-report: implemented",
  "actionable-settings-health: implemented",
  "refreshable-settings-diagnostics: implemented",
  "settings-list-detail-navigation: implemented",
  "keyboard-managed-compact-panels: implemented",
  "artifact-tab-keyboard-navigation: implemented",
  "privacy-preserving-local-product-metrics: implemented",
  "product-metrics-content-verifier: implemented",
  "compact-entity-context-bar: implemented",
  "direct-empty-task-actions: implemented",
  "intentional-artifact-drawer: implemented",
  "custom-dataset-display-names: implemented",
  "dataset-version-history-popover: implemented",
  "business-topic-group-cadence: implemented",
  "conversation-context-menus: implemented",
  "top-right-history-result-workflow-controls: implemented",
  "static-dynamic-workflow-graph: implemented",
  "conversation-workflow-finalization: implemented",
  "calendar-workflow-triggers: implemented",
  "os-workflow-notifications: implemented",
  "chat-result-csv-export: implemented",
], "product manifest");

if (failures.length > 0) {
  console.error(`Product experience verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Product experience verified: conversation-first hierarchy, thread ownership, artifacts, settings, accessibility, and compact reflow are aligned.");
