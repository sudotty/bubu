import { randomBytes } from "node:crypto";
import { dialog, ipcMain } from "electron";
import {
  parseDatasetGroupId,
  parseDatasetGroupSaveInput,
  parseDatasetId,
  parseDerivedDatasetCreateInput,
  parseDataCleanPreviewRequest,
  parseDataCleanApproval,
  parseReconciliationPreviewRequest,
  parseReconciliationApproval,
  parseReconciliationDatasetIds,
  parseDatasetRenameInput,
  parseDatasetReplacementMappingInput,
  parseDatasetValidationSaveInput,
  parseColumnDistributionRequest,
  parseDatasetRelationshipSaveInput,
  parseDatasetPreviewRequest,
  parseConversationTarget,
  parseConversationId,
  parseConversationEntryPageRequest,
  parseConversationCreateInput,
  parseConversationRenameInput,
  parseConversationArchiveInput,
  parseConversationDeleteInput,
  parseConversationRetentionPolicy,
  parseConversationListInput,
  parseProviderConfigurationInput,
  parseProviderConnectionResult,
  parseProviderId,
  parseRelationshipId,
  parseOperationEnvelope,
  parseOperationId,
  parseOperationStart,
  parseFileArrivalApproval,
  parseFileArrivalDismissal,
  parsePrivacyPolicy,
  parseAgentDefinitionId,
  parseAgentDefinitionSaveInput,
  parsePortableRendererPreferences,
  parseConfigurationRestoreFinalization,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { ProviderStore } from "./provider-store.js";
import { isTrustedFrameUrl } from "./security.js";
import type { SidecarSupervisor } from "./sidecars.js";
import { createReplacementSessionStore } from "./replacement-sessions.js";
import { createAggregateApprovalSessionStore } from "./aggregate-approval-sessions.js";
import { createDataCleanApprovalSessionStore } from "./data-clean-approval-sessions.js";
import { createAggregateAgentApprovalSessionStore } from "./aggregate-agent-approval-sessions.js";
import { registerDatasetLifecycleApi } from "./dataset-lifecycle-api.js";
import { registerBackupApi } from "./backup-api.js";
import { createOperationRegistry } from "./operation-registry.js";
import { registerAnalysisApi } from "./analysis-api.js";
import { registerWorkflowApi } from "./workflow-api.js";
import { registerExternalDeliveryApi } from "./external-delivery-api.js";
import type { ExternalDeliveryService } from "./external-delivery-service.js";
import { registerHubSyncApi } from "./hub-sync-api.js";
import type { HubSyncService } from "./hub-sync-service.js";
import { generateAuditedModel } from "./model-audit.js";
import type { McpConnectionStore } from "./mcp-connection-store.js";
import { createMcpInspectionApprovalSessionStore } from "./mcp-inspection-approval-sessions.js";
import { registerMcpApi } from "./mcp-api.js";
import type { McpAuditStore } from "./mcp-audit-store.js";
import { createMcpResourceApprovalSessionStore } from "./mcp-resource-approval-sessions.js";
import { registerMcpResourceApi } from "./mcp-resource-api.js";
import { createMcpPromptApprovalSessionStore } from "./mcp-prompt-approval-sessions.js";
import { registerMcpPromptApi } from "./mcp-prompt-api.js";
import { createMcpToolApprovalSessionStore } from "./mcp-tool-approval-sessions.js";
import { registerMcpToolApi } from "./mcp-tool-api.js";
import { registerArtifactApi } from "./artifact-api.js";
import type { ProductMetricsStore } from "./product-metrics.js";
import { createDemoWorkspace } from "./demo-catalog.js";
import { createReconciliationApprovalSessionStore } from "./reconciliation-approval-sessions.js";
import type { FileArrivalStore } from "./file-arrival-store.js";
import type { PrivacyPolicyStore } from "./privacy-policy-store.js";
import type { AgentDefinitionStore } from "./agent-definition-store.js";
import { createExplicitRowApprovalSessionStore } from "./explicit-row-approval-sessions.js";
import { registerExplicitRowApi } from "./explicit-row-api.js";
import { createKnowledgeApprovalSessionStore } from "./knowledge-approval-sessions.js";
import { registerKnowledgeApi } from "./knowledge-api.js";
import { createMcpModelApprovalSessionStore } from "./mcp-model-approval-sessions.js";
import { registerMcpModelApi } from "./mcp-model-api.js";
import type { RemoteMcpStore } from "./remote-mcp-store.js";
import { createRemoteMcpInspectionApprovalStore } from "./remote-mcp-approval-sessions.js";
import { createRemoteMcpOAuthSessionStore } from "./remote-mcp-oauth-sessions.js";
import { registerRemoteMcpApi } from "./remote-mcp-api.js";
import type { RemoteMcpAuditStore } from "./remote-mcp-audit-store.js";
import type { ConversationRetentionStore } from "./conversation-retention-store.js";
import type { ConfigurationBackupService } from "./configuration-backup-service.js";

interface DesktopApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly providerStore: ProviderStore;
  readonly mcpConnectionStore: McpConnectionStore;
  readonly mcpAuditStore: McpAuditStore;
  readonly mcpRuntimeDirectory: string;
  readonly remoteMcpStore: RemoteMcpStore;
  readonly remoteMcpAuditStore: RemoteMcpAuditStore;
  readonly developmentServerUrl: string | undefined;
  readonly metrics: ProductMetricsStore;
  readonly demoDirectory: string;
  readonly fileArrivals: FileArrivalStore;
  readonly privacyPolicy: PrivacyPolicyStore;
  readonly agentDefinitions: AgentDefinitionStore;
  readonly externalDelivery: ExternalDeliveryService;
  readonly hubSync: HubSyncService;
  readonly conversationRetention: ConversationRetentionStore;
  readonly configurationBackup: ConfigurationBackupService;
  readonly configurationBackupPaths?: { readonly exportPath: string; readonly importPath: string };
}

export function registerDesktopApi({
  sidecars,
  providerStore,
  mcpConnectionStore,
  mcpAuditStore,
  mcpRuntimeDirectory,
  remoteMcpStore,
  remoteMcpAuditStore,
  developmentServerUrl,
  metrics,
  demoDirectory,
  fileArrivals,
  privacyPolicy,
  agentDefinitions,
  externalDelivery,
  hubSync,
  conversationRetention,
  configurationBackup,
  configurationBackupPaths,
}: DesktopApiDependencies): void {
  const replacementSessions = createReplacementSessionStore({
    now: Date.now,
    newToken: () => randomBytes(16).toString("hex"),
  });
  const operations = createOperationRegistry();
  let demoWorkspaceImporting = false;
  const aggregateApprovals = createAggregateApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const dataCleanApprovals = createDataCleanApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const reconciliationApprovals = createReconciliationApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const aggregateAgentApprovals = createAggregateAgentApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const mcpInspectionApprovals = createMcpInspectionApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const mcpResourceApprovals = createMcpResourceApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const mcpPromptApprovals = createMcpPromptApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const mcpToolApprovals = createMcpToolApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const mcpModelApprovals = createMcpModelApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const remoteMcpInspections = createRemoteMcpInspectionApprovalStore({ now: Date.now, newToken: () => randomBytes(32).toString("hex") });
  const remoteMcpOAuth = createRemoteMcpOAuthSessionStore({ now: Date.now });
  const explicitRowApprovals = createExplicitRowApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const knowledgeApprovals = createKnowledgeApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const assertTrustedSender = (frameUrl: string) => {
    if (!isTrustedFrameUrl(frameUrl, developmentServerUrl)) {
      throw new Error("Untrusted renderer attempted to call the desktop API");
    }
  };

  registerDatasetLifecycleApi({ sidecars, assertTrustedSender, operations });
  registerArtifactApi({ assertTrustedSender });
  registerBackupApi({ sidecars, assertTrustedSender, operations });
  registerAnalysisApi({
    sidecars, providerStore, operations, aggregateApprovals, aggregateAgentApprovals, privacyPolicy, assertTrustedSender,
  });
  registerExplicitRowApi({
    sidecars, providerStore, operations, approvals: explicitRowApprovals, privacyPolicy, assertTrustedSender,
  });
  registerKnowledgeApi({
    sidecars, providerStore, operations, approvals: knowledgeApprovals, privacyPolicy, assertTrustedSender,
  });
  registerWorkflowApi({ sidecars, operations, assertTrustedSender, externalDelivery });
  registerExternalDeliveryApi({ sidecars, delivery: externalDelivery, assertTrustedSender });
  registerHubSyncApi({ sidecars, hub: hubSync, assertTrustedSender });
  registerMcpApi({
    sidecars,
    connections: mcpConnectionStore,
    approvals: mcpInspectionApprovals,
    operations,
    runtimeDirectory: mcpRuntimeDirectory,
    assertTrustedSender,
  });
  registerMcpResourceApi({
    sidecars,
    connections: mcpConnectionStore,
    approvals: mcpResourceApprovals,
    audits: mcpAuditStore,
    operations,
    runtimeDirectory: mcpRuntimeDirectory,
    assertTrustedSender,
  });
  registerMcpPromptApi({
    sidecars,
    connections: mcpConnectionStore,
    approvals: mcpPromptApprovals,
    audits: mcpAuditStore,
    operations,
    runtimeDirectory: mcpRuntimeDirectory,
    assertTrustedSender,
  });
  registerMcpToolApi({
    sidecars,
    connections: mcpConnectionStore,
    approvals: mcpToolApprovals,
    audits: mcpAuditStore,
    operations,
    runtimeDirectory: mcpRuntimeDirectory,
    assertTrustedSender,
  });
  registerMcpModelApi({
    sidecars,
    providers: providerStore,
    connections: mcpConnectionStore,
    approvals: mcpModelApprovals,
    toolApprovals: mcpToolApprovals,
    audits: mcpAuditStore,
    operations,
    privacyPolicy,
    runtimeDirectory: mcpRuntimeDirectory,
    assertTrustedSender,
  });
  registerRemoteMcpApi({ sidecars, store: remoteMcpStore, oauth: remoteMcpOAuth, inspections: remoteMcpInspections, audits: remoteMcpAuditStore, operations, assertTrustedSender });

  ipcMain.handle(desktopChannels.cancelOperation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const operationId = parseOperationId(value);
    return { operationId, cancelled: operations.cancel(operationId) };
  });
  ipcMain.handle(desktopChannels.recordProductMetric, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    await metrics.record(value);
  });
  ipcMain.handle(desktopChannels.getPrivacyPolicy, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return privacyPolicy.state();
  });
  ipcMain.handle(desktopChannels.listAgentDefinitions, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return agentDefinitions.state();
  });
  ipcMain.handle(desktopChannels.saveAgentDefinition, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseAgentDefinitionSaveInput(value);
    privacyPolicy.assertModelTextAllowed(input.goal);
    return agentDefinitions.save(input);
  });
  ipcMain.handle(desktopChannels.removeAgentDefinition, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return agentDefinitions.remove(parseAgentDefinitionId(value));
  });
  ipcMain.handle(desktopChannels.savePrivacyPolicy, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return privacyPolicy.save(parsePrivacyPolicy(value));
  });
  ipcMain.handle(desktopChannels.inspectPrivacyText, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    if (typeof value !== "string" || value.length > 20_000) throw new Error("隐私检查文本无效");
    return privacyPolicy.inspect(value);
  });
  ipcMain.handle(desktopChannels.createConfigurationBackup, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const rendererPreferences = parsePortableRendererPreferences(value);
    const selected = configurationBackupPaths
      ? { canceled: false, filePath: configurationBackupPaths.exportPath }
      : await dialog.showSaveDialog({
      title: "导出 BuBu 设置",
      defaultPath: `bubu-settings-${new Date().toISOString().slice(0, 10)}.bubu-settings`,
      filters: [{ name: "BuBu 设置", extensions: ["bubu-settings"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    if (selected.canceled || !selected.filePath) return { status: "cancelled" };
    const bundle = configurationBackup.create(selected.filePath, rendererPreferences);
    return { status: "created", fileName: selected.filePath.split(/[\\/]/u).at(-1), createdAt: bundle.createdAt };
  });
  ipcMain.handle(desktopChannels.restoreConfigurationBackup, async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const selected = configurationBackupPaths
      ? { canceled: false, filePaths: [configurationBackupPaths.importPath] }
      : await dialog.showOpenDialog({
      title: "恢复 BuBu 设置",
      filters: [{ name: "BuBu 设置", extensions: ["bubu-settings"] }],
      properties: ["openFile"],
    });
    if (selected.canceled || selected.filePaths.length !== 1) return { status: "cancelled" };
    return configurationBackup.restore(selected.filePaths[0]!);
  });
  ipcMain.handle(desktopChannels.finalizeConfigurationRestore, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseConfigurationRestoreFinalization(value);
    configurationBackup.finalizeRestore(input.rollbackToken, input.commit);
  });

  ipcMain.handle(desktopChannels.getReadiness, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.readiness();
  });
  ipcMain.handle(desktopChannels.listDatasets, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listDatasets();
  });
  ipcMain.handle(desktopChannels.materializeDerivedDataset, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const input = parseDerivedDatasetCreateInput(envelope.value);
    if (input.transformation.kind === "data-clean") throw new Error("Data Clean 必须先预览影响并使用一次性批准执行");
    return operations.run(envelope.operationId, (signal) => sidecars.materializeDerivedDataset(input, signal));
  });
  ipcMain.handle(desktopChannels.prepareDataClean, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const request = parseDataCleanPreviewRequest(envelope.value);
    const preview = await operations.run(envelope.operationId, (signal) => sidecars.previewDataCleanPlan(request.cleanPlan, request.qualityPolicy, signal));
	return dataCleanApprovals.issue(request, preview.impact, preview.quality);
  });
  ipcMain.handle(desktopChannels.approveDataClean, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseDataCleanApproval(envelope.value);
    const reviewed = dataCleanApprovals.consume(approval.approvalToken);
    return operations.run(envelope.operationId, (signal) => sidecars.materializeDerivedDataset({
      displayName: reviewed.request.displayName,
      transformation: { kind: "data-clean", cleanPlan: reviewed.request.cleanPlan },
	  review: { kind: "one-use-approval", planFingerprint: reviewed.impact.planFingerprint, qualityPolicyFingerprint: reviewed.quality.policyFingerprint, reviewedAt: reviewed.reviewedAt },
	  qualityPolicy: reviewed.request.qualityPolicy,
    }, signal));
  });
  ipcMain.handle(desktopChannels.dismissDataClean, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const approval = parseDataCleanApproval(value);
    dataCleanApprovals.revoke(approval.approvalToken);
  });
  ipcMain.handle(desktopChannels.prepareReconciliation, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const request = parseReconciliationPreviewRequest(envelope.value);
    const preview = await operations.run(envelope.operationId, (signal) => sidecars.previewReconciliation(request.plan, signal));
    return reconciliationApprovals.issue(request, preview);
  });
  ipcMain.handle(desktopChannels.approveReconciliation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseReconciliationApproval(envelope.value);
    const reviewed = reconciliationApprovals.consume(approval.approvalToken);
    return operations.run(envelope.operationId, (signal) => sidecars.executeReconciliation(reviewed.request.plan, reviewed.preview.planFingerprint, reviewed.reviewedAt, signal));
  });
  ipcMain.handle(desktopChannels.dismissReconciliation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const approval = parseReconciliationApproval(value);
    reconciliationApprovals.revoke(approval.approvalToken);
  });
  ipcMain.handle(desktopChannels.getReconciliationArtifact, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getReconciliationArtifact(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.saveReconciliationDefinition, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.saveReconciliationDefinition(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.listReconciliationArtifacts, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listReconciliationArtifacts(parseReconciliationDatasetIds(value));
  });
  ipcMain.handle(desktopChannels.listReconciliationReplayEvents, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listReconciliationReplayEvents(parseReconciliationDatasetIds(value));
  });
  ipcMain.handle(desktopChannels.retryReconciliationReplayEvent, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.retryReconciliationReplayEvent(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.cancelReconciliationReplayEvent, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.cancelReconciliationReplayEvent(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.recomputeDerivedDataset, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const datasetID = parseDatasetId(envelope.value);
    return operations.run(envelope.operationId, (signal) => sidecars.recomputeDerivedDataset(datasetID, signal));
  });
  ipcMain.handle(desktopChannels.getDerivedDatasetLineage, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getDerivedDatasetLineage(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.getDerivedDependencyPlan, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getDerivedDependencyPlan(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.listDerivedRecomputeEvents, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listDerivedRecomputeEvents(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.retryDerivedRecomputeEvent, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.retryDerivedRecomputeEvent(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.cancelDerivedRecomputeEvent, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.cancelDerivedRecomputeEvent(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.importDemoWorkspace, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    if (demoWorkspaceImporting) throw new Error("示例工作区正在创建，请稍候");
    demoWorkspaceImporting = true;
    try {
      return await operations.run(envelope.operationId, (signal) =>
        createDemoWorkspace(envelope.value, demoDirectory, sidecars, signal));
    } finally {
      demoWorkspaceImporting = false;
    }
  });
  ipcMain.handle(desktopChannels.renameDataset, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.renameDataset(parseDatasetRenameInput(value));
  });
  ipcMain.handle(desktopChannels.listDatasetVersions, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listDatasetVersions(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.importDatasets, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const { operationId } = parseOperationStart(value);
    const selection = await dialog.showOpenDialog({
      title: "导入 Excel 或 CSV",
      buttonLabel: "导入到 BuBu",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "表格文件", extensions: ["csv", "tsv", "xlsx"] },
        { name: "CSV", extensions: ["csv", "tsv"] },
        { name: "Excel", extensions: ["xlsx"] },
      ],
    });
    if (selection.canceled || selection.filePaths.length === 0) return { datasets: [] };
    return operations.run(operationId, (signal) => sidecars.importFiles(selection.filePaths, signal));
  });
  ipcMain.handle(desktopChannels.configureFileArrivals, async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const selection = await dialog.showOpenDialog({ title: "批准周期文件夹", buttonLabel: "开始识别新文件", properties: ["openDirectory", "createDirectory"] });
    const folderPath = selection.filePaths[0];
    if (selection.canceled || !folderPath) return fileArrivals.state();
    return fileArrivals.configure(folderPath);
  });
  ipcMain.handle(desktopChannels.listFileArrivals, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return fileArrivals.state();
  });
  ipcMain.handle(desktopChannels.approveFileArrival, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const input = parseFileArrivalApproval(envelope.value);
    const pending = await fileArrivals.source(input.arrivalId);
    if (!pending.item.candidates.some(({ datasetId }) => datasetId === input.datasetId)) throw new Error("Selected data object is not a reviewed arrival candidate");
    await fileArrivals.update(input.arrivalId, { status: "processing", selectedDatasetId: input.datasetId, candidates: [...pending.item.candidates].sort((left, right) => Number(right.datasetId === input.datasetId) - Number(left.datasetId === input.datasetId)), message: "正在由本地数据内核创建不可变新版本。" });
    try {
      const replacement = await operations.run(envelope.operationId, (signal) => sidecars.replaceDataset(input.datasetId, pending.sourcePath, signal));
      if (replacement.status === "mapping-required") {
        const replacementToken = replacementSessions.issue(input.datasetId, pending.sourcePath, input.arrivalId);
        const arrival = (await fileArrivals.update(input.arrivalId, { status: "mapping-required", message: "列结构发生变化；确认映射前不会替换当前版本。" })).items.find(({ id }) => id === input.arrivalId);
        if (!arrival) throw new Error("File arrival item disappeared");
        return { arrival, replacement: { status: "mapping-required", replacementToken, drift: replacement.drift } };
      }
      const arrival = (await fileArrivals.update(input.arrivalId, { status: "completed", message: `已创建版本 ${replacement.dataset.version}；周期任务会复用既有触发队列。` })).items.find(({ id }) => id === input.arrivalId);
      if (!arrival) throw new Error("File arrival item disappeared");
      return { arrival, replacement };
    } catch (error) {
      await fileArrivals.update(input.arrivalId, { status: "failed", message: "本地替换失败；未创建部分版本，可以安全重试。" });
      throw error;
    }
  });
  ipcMain.handle(desktopChannels.dismissFileArrival, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return fileArrivals.dismiss(parseFileArrivalDismissal(value).arrivalId);
  });
  ipcMain.handle(desktopChannels.previewDataset, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.previewDataset(parseDatasetPreviewRequest(value));
  });
  ipcMain.handle(desktopChannels.getDatasetStructure, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.datasetStructure(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.replaceDataset, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const datasetID = parseDatasetId(envelope.value);
    const selection = await dialog.showOpenDialog({
      title: "替换数据版本",
      buttonLabel: "创建新版本",
      properties: ["openFile"],
      filters: [
        { name: "表格文件", extensions: ["csv", "tsv", "xlsx"] },
        { name: "CSV", extensions: ["csv", "tsv"] },
        { name: "Excel", extensions: ["xlsx"] },
      ],
    });
    const sourcePath = selection.filePaths[0];
    if (selection.canceled || !sourcePath) return { status: "cancelled" } as const;
    const result = await operations.run(envelope.operationId, (signal) =>
      sidecars.replaceDataset(datasetID, sourcePath, signal));
    if (result.status === "mapping-required") {
      return {
        status: result.status,
        replacementToken: replacementSessions.issue(datasetID, sourcePath),
        drift: result.drift,
      } as const;
    }
    return result;
  });
  ipcMain.handle(desktopChannels.applyReplacementMapping, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const input = parseDatasetReplacementMappingInput(envelope.value);
    const pending = replacementSessions.consume(input.replacementToken);
    return operations.run(envelope.operationId, async (signal) => {
      const result = await sidecars.replaceDatasetWithMapping(
        pending.datasetId,
        pending.sourcePath,
        input.mappings,
        signal,
      );
      if (pending.arrivalId && result.status === "replaced") await fileArrivals.update(pending.arrivalId, { status: "completed", message: `映射已审查并创建版本 ${result.dataset.version}。` });
      return result;
    });
  });
  ipcMain.handle(desktopChannels.getDatasetQuality, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getDatasetQuality(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.getColumnDistribution, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    return operations.run(envelope.operationId, (signal) =>
      sidecars.getColumnDistribution(parseColumnDistributionRequest(envelope.value), signal));
  });
  ipcMain.handle(desktopChannels.saveDatasetValidation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.saveDatasetValidation(parseDatasetValidationSaveInput(value));
  });
  ipcMain.handle(desktopChannels.listProviders, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return providerStore.state();
  });
  ipcMain.handle(desktopChannels.saveProvider, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return providerStore.save(parseProviderConfigurationInput(value));
  });
  ipcMain.handle(desktopChannels.selectProvider, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return providerStore.select(parseProviderId(value));
  });
  ipcMain.handle(desktopChannels.removeProvider, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return providerStore.remove(parseProviderId(value));
  });
  ipcMain.handle(desktopChannels.testProvider, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const resolved = providerStore.resolve(parseProviderId(envelope.value));
    return operations.run(envelope.operationId, async (signal) => {
      const startedAt = Date.now();
      const completion = await generateAuditedModel(sidecars, {
        provider: resolved.profile,
        credential: resolved.credential,
        system: "You are a connectivity check. Return a short confirmation.",
        user: "Confirm that this model endpoint is reachable.",
        maxOutputTokens: 16,
      }, {
        purpose: "provider-connection-test",
        target: { kind: "system" },
        contexts: [],
        relationshipCount: 0,
      }, signal);
      return parseProviderConnectionResult({
        status: "connected",
        providerId: completion.providerId,
        providerKind: completion.providerKind,
        model: completion.model,
        latencyMs: Date.now() - startedAt,
      });
    });
  });
  ipcMain.handle(desktopChannels.listModelAudits, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listModelAudits();
  });
  ipcMain.handle(desktopChannels.listDatasetGroups, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listGroups();
  });
  ipcMain.handle(desktopChannels.saveDatasetGroup, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.saveGroup(parseDatasetGroupSaveInput(value));
  });
  ipcMain.handle(desktopChannels.removeDatasetGroup, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    await sidecars.deleteGroup(parseDatasetGroupId(value));
    return sidecars.listGroups();
  });
  ipcMain.handle(desktopChannels.getConversation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getConversation(parseConversationTarget(value));
  });
  ipcMain.handle(desktopChannels.getConversationById, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getConversationByID(parseConversationId(value));
  });
  ipcMain.handle(desktopChannels.pageConversationEntries, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.pageConversationEntries(parseConversationEntryPageRequest(value));
  });
  ipcMain.handle(desktopChannels.listConversations, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseConversationListInput(value);
    return sidecars.listConversations(input.target, input.archived);
  });
  ipcMain.handle(desktopChannels.createConversation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.createConversation(parseConversationCreateInput(value));
  });
  ipcMain.handle(desktopChannels.renameConversation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.renameConversation(parseConversationRenameInput(value));
  });
  ipcMain.handle(desktopChannels.archiveConversation, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    await sidecars.archiveConversation(parseConversationArchiveInput(value));
  });
  ipcMain.handle(desktopChannels.deleteConversation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.deleteConversation(parseConversationDeleteInput(value));
  });
  ipcMain.handle(desktopChannels.getConversationRetentionPolicy, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return conversationRetention.state();
  });
  ipcMain.handle(desktopChannels.saveConversationRetentionPolicy, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const policy = conversationRetention.save(parseConversationRetentionPolicy(value));
    if (policy.enabled) await sidecars.applyConversationRetention(policy.retentionDays);
    return policy;
  });
  ipcMain.handle(desktopChannels.getGroupRelationships, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getGroupRelationships(parseDatasetGroupId(value));
  });
  ipcMain.handle(desktopChannels.saveDatasetRelationship, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.saveDatasetRelationship(parseDatasetRelationshipSaveInput(value));
  });
  ipcMain.handle(desktopChannels.removeDatasetRelationship, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    await sidecars.deleteDatasetRelationship(parseRelationshipId(value));
  });
}
