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
  parseGroupQueryRequest,
  parseProviderConfigurationInput,
  parseProviderConnectionResult,
  parseProviderId,
  parseQueryPlanRequest,
  parseSafeGroupQueryPlan,
  parseSafeQueryPlan,
  parseRelationshipId,
  type ConversationThread,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import {
  buildGroupQueryPlanInvocation,
  buildQueryPlanInvocation,
  createGroupQueryPlanProposal,
  createQueryPlanProposal,
  relationshipHintsForGroup,
} from "./analysis-orchestrator.js";
import type { ProviderStore } from "./provider-store.js";
import { isTrustedFrameUrl } from "./security.js";
import type { SidecarSupervisor } from "./sidecars.js";
import { createReplacementSessionStore } from "./replacement-sessions.js";
import { registerDatasetLifecycleApi } from "./dataset-lifecycle-api.js";
import { registerBackupApi } from "./backup-api.js";

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
  const assertTrustedSender = (frameUrl: string) => {
    if (!isTrustedFrameUrl(frameUrl, developmentServerUrl)) {
      throw new Error("Untrusted renderer attempted to call the desktop API");
    }
  };

  const errorMessage = (error: unknown) =>
    (error instanceof Error ? error.message : "分析失败").slice(0, 2_000);

  const persistError = async (target: { readonly kind: "dataset" | "group"; readonly id: string }, error: unknown) => {
    await sidecars.appendConversation({
      target,
      entry: { kind: "error", role: "system", payload: { message: errorMessage(error) } },
    }).catch(() => undefined);
  };

  const containsProposedPlan = (thread: ConversationThread | null, plan: unknown) => {
    const encoded = JSON.stringify(plan);
    return thread?.entries.some((entry) =>
      entry.kind === "plan" && JSON.stringify(entry.payload.proposal.plan) === encoded,
    ) ?? false;
  };

  registerDatasetLifecycleApi({ sidecars, assertTrustedSender });
  registerBackupApi({ sidecars, assertTrustedSender });

  ipcMain.handle(desktopChannels.getReadiness, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.readiness();
  });
  ipcMain.handle(desktopChannels.listDatasets, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listDatasets();
  });
  ipcMain.handle(desktopChannels.importDatasets, async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
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
    return sidecars.importFiles(selection.filePaths);
  });
  ipcMain.handle(desktopChannels.previewDataset, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.previewDataset(parseDatasetPreviewRequest(value));
  });
  ipcMain.handle(desktopChannels.replaceDataset, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const datasetID = parseDatasetId(value);
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
    const result = await sidecars.replaceDataset(datasetID, sourcePath);
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
    const input = parseDatasetReplacementMappingInput(value);
    const pending = replacementSessions.consume(input.replacementToken);
    return sidecars.replaceDatasetWithMapping(
      pending.datasetId,
      pending.sourcePath,
      input.mappings,
    );
  });
  ipcMain.handle(desktopChannels.getDatasetQuality, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getDatasetQuality(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.getColumnDistribution, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.getColumnDistribution(parseColumnDistributionRequest(value));
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
    const resolved = providerStore.resolve(parseProviderId(value));
    const startedAt = Date.now();
    const completion = await sidecars.generateModel({
      provider: resolved.profile,
      credential: resolved.credential,
      system: "You are a connectivity check. Return a short confirmation.",
      user: "Confirm that this model endpoint is reachable.",
      maxOutputTokens: 16,
    });
    return parseProviderConnectionResult({
      status: "connected",
      providerId: completion.providerId,
      providerKind: completion.providerKind,
      model: completion.model,
      latencyMs: Date.now() - startedAt,
    });
  });
  ipcMain.handle(desktopChannels.proposeQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const request = parseQueryPlanRequest(value);
    const target = { kind: "dataset", id: request.datasetId } as const;
    await sidecars.appendConversation({
      target,
      entry: { kind: "question", role: "user", payload: { question: request.question } },
    });
    try {
      const activeProviderId = providerStore.state().activeProviderId;
      if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
      const [context, resolved] = await Promise.all([
        sidecars.modelContext(request.datasetId, "schema-synthetic"),
        Promise.resolve(providerStore.resolve(activeProviderId)),
      ]);
      const completion = await sidecars.generateModel(
        buildQueryPlanInvocation(resolved, context, request.question),
      );
      const proposal = createQueryPlanProposal(request.question, context, completion);
      await sidecars.appendConversation({
        target,
        entry: { kind: "plan", role: "assistant", payload: { proposal } },
      });
      return proposal;
    } catch (error) {
      await persistError(target, error);
      throw error;
    }
  });
  ipcMain.handle(desktopChannels.executeQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const plan = parseSafeQueryPlan(value);
    const target = { kind: "dataset", id: plan.datasetId } as const;
    if (!containsProposedPlan(await sidecars.getConversation(target), plan)) {
      throw new Error("只能执行已经生成并审查的查询计划");
    }
    try {
      const result = await sidecars.executeQueryPlan(plan);
      await sidecars.appendConversation({
        target,
        entry: { kind: "result", role: "assistant", payload: { result } },
      });
      return result;
    } catch (error) {
      await persistError(target, error);
      throw error;
    }
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
  ipcMain.handle(desktopChannels.proposeGroupQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const request = parseGroupQueryRequest(value);
    const target = { kind: "group", id: request.groupId } as const;
    await sidecars.appendConversation({
      target,
      entry: { kind: "question", role: "user", payload: { question: request.question } },
    });
    try {
      const groups = await sidecars.listGroups();
      const group = groups.find(({ id }) => id === request.groupId);
      if (!group) throw new Error("数据群组不存在");
      const activeProviderId = providerStore.state().activeProviderId;
      if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
      const [contexts, relationshipOverview] = await Promise.all([
        Promise.all(group.members.map(({ id }) => sidecars.modelContext(id, "schema-synthetic"))),
        sidecars.getGroupRelationships(group.id),
      ]);
      const relationshipHints = relationshipHintsForGroup(
        group.members.map(({ id }) => id),
        relationshipOverview.relationships,
      );
      const completion = await sidecars.generateModel(
        buildGroupQueryPlanInvocation(
          providerStore.resolve(activeProviderId),
          group.id,
          contexts,
          relationshipHints,
          request.question,
        ),
      );
      const proposal = createGroupQueryPlanProposal(request.question, contexts, relationshipHints, completion);
      await sidecars.appendConversation({
        target,
        entry: { kind: "plan", role: "assistant", payload: { proposal } },
      });
      return proposal;
    } catch (error) {
      await persistError(target, error);
      throw error;
    }
  });
  ipcMain.handle(desktopChannels.executeGroupQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const plan = parseSafeGroupQueryPlan(value);
    const target = { kind: "group", id: plan.groupId } as const;
    if (!containsProposedPlan(await sidecars.getConversation(target), plan)) {
      throw new Error("只能执行已经生成并审查的群组计划");
    }
    try {
      const result = await sidecars.executeGroupQueryPlan(plan);
      await sidecars.appendConversation({
        target,
        entry: { kind: "result", role: "assistant", payload: { result } },
      });
      return result;
    } catch (error) {
      await persistError(target, error);
      throw error;
    }
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
