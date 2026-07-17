import { dialog, ipcMain } from "electron";
import {
  parseDatasetGroupId,
  parseDatasetGroupSaveInput,
  parseDatasetId,
  parseDatasetPreviewRequest,
  parseProviderConfigurationInput,
  parseProviderConnectionResult,
  parseProviderId,
  parseQueryPlanRequest,
  parseSafeQueryPlan,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import { buildQueryPlanInvocation, createQueryPlanProposal } from "./analysis-orchestrator.js";
import type { ProviderStore } from "./provider-store.js";
import { isTrustedFrameUrl } from "./security.js";
import type { SidecarSupervisor } from "./sidecars.js";

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
  const assertTrustedSender = (frameUrl: string) => {
    if (!isTrustedFrameUrl(frameUrl, developmentServerUrl)) {
      throw new Error("Untrusted renderer attempted to call the desktop API");
    }
  };

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
    return sidecars.replaceDataset(datasetID, sourcePath);
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
    const activeProviderId = providerStore.state().activeProviderId;
    if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
    const [context, resolved] = await Promise.all([
      sidecars.modelContext(request.datasetId, "schema-synthetic"),
      Promise.resolve(providerStore.resolve(activeProviderId)),
    ]);
    const completion = await sidecars.generateModel(
      buildQueryPlanInvocation(resolved, context, request.question),
    );
    return createQueryPlanProposal(request.question, context, completion);
  });
  ipcMain.handle(desktopChannels.executeQueryPlan, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.executeQueryPlan(parseSafeQueryPlan(value));
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
}
