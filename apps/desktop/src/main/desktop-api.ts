import { randomBytes } from "node:crypto";
import { dialog, ipcMain } from "electron";
import {
  parseDatasetGroupId,
  parseDatasetGroupSaveInput,
  parseDatasetId,
  parseDatasetReplacementMappingInput,
  parseDatasetValidationSaveInput,
  parseColumnDistributionRequest,
  parseDatasetRelationshipSaveInput,
  parseDatasetPreviewRequest,
  parseConversationTarget,
  parseProviderConfigurationInput,
  parseProviderConnectionResult,
  parseProviderId,
  parseRelationshipId,
  parseOperationEnvelope,
  parseOperationId,
  parseOperationStart,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { ProviderStore } from "./provider-store.js";
import { isTrustedFrameUrl } from "./security.js";
import type { SidecarSupervisor } from "./sidecars.js";
import { createReplacementSessionStore } from "./replacement-sessions.js";
import { createAggregateApprovalSessionStore } from "./aggregate-approval-sessions.js";
import { registerDatasetLifecycleApi } from "./dataset-lifecycle-api.js";
import { registerBackupApi } from "./backup-api.js";
import { createOperationRegistry } from "./operation-registry.js";
import { registerAnalysisApi } from "./analysis-api.js";
import { registerWorkflowApi } from "./workflow-api.js";
import { generateAuditedModel } from "./model-audit.js";

interface DesktopApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly providerStore: ProviderStore;
  readonly developmentServerUrl: string | undefined;
}

export function registerDesktopApi({
  sidecars,
  providerStore,
  developmentServerUrl,
}: DesktopApiDependencies): void {
  const replacementSessions = createReplacementSessionStore({
    now: Date.now,
    newToken: () => randomBytes(16).toString("hex"),
  });
  const operations = createOperationRegistry();
  const aggregateApprovals = createAggregateApprovalSessionStore({
    now: Date.now,
    newToken: () => randomBytes(32).toString("hex"),
  });
  const assertTrustedSender = (frameUrl: string) => {
    if (!isTrustedFrameUrl(frameUrl, developmentServerUrl)) {
      throw new Error("Untrusted renderer attempted to call the desktop API");
    }
  };

  registerDatasetLifecycleApi({ sidecars, assertTrustedSender, operations });
  registerBackupApi({ sidecars, assertTrustedSender, operations });
  registerAnalysisApi({ sidecars, providerStore, operations, aggregateApprovals, assertTrustedSender });
  registerWorkflowApi({ sidecars, operations, assertTrustedSender });

  ipcMain.handle(desktopChannels.cancelOperation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const operationId = parseOperationId(value);
    return { operationId, cancelled: operations.cancel(operationId) };
  });

  ipcMain.handle(desktopChannels.getReadiness, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.readiness();
  });
  ipcMain.handle(desktopChannels.listDatasets, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listDatasets();
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
  ipcMain.handle(desktopChannels.previewDataset, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.previewDataset(parseDatasetPreviewRequest(value));
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
    return operations.run(envelope.operationId, (signal) =>
      sidecars.replaceDatasetWithMapping(
        pending.datasetId,
        pending.sourcePath,
        input.mappings,
        signal,
      ));
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
