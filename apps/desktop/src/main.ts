import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  app,
  BrowserWindow,
  Notification,
  net,
  protocol,
  safeStorage,
  session,
} from "electron";
import started from "electron-squirrel-startup";
import {
  contentSecurityPolicy,
  resolveRendererAsset,
  secureWebPreferences,
} from "./main/security.js";
import { parseLaunchMode } from "./main/launch-mode.js";
import { startSidecars, type SidecarSupervisor } from "./main/sidecars.js";
import { createProviderStore } from "./main/provider-store.js";
import { registerDesktopApi } from "./main/desktop-api.js";
import { startWorkflowTriggerScheduler } from "./main/workflow-trigger-scheduler.js";
import { startDerivedRecomputeScheduler } from "./main/derived-recompute-scheduler.js";
import { startReconciliationReplayScheduler } from "./main/reconciliation-replay-scheduler.js";
import { createMcpConnectionStore } from "./main/mcp-connection-store.js";
import { createMcpAuditStore } from "./main/mcp-audit-store.js";
import { createFileArrivalStore, type FileArrivalStore } from "./main/file-arrival-store.js";
import { createProductMetricsStore } from "./main/product-metrics.js";
import { createPrivacyPolicyStore } from "./main/privacy-policy-store.js";
import { createAgentDefinitionStore } from "./main/agent-definition-store.js";
import { createConversationRetentionStore } from "./main/conversation-retention-store.js";
import { createConfigurationBackupService } from "./main/configuration-backup-service.js";
import { startConversationRetentionScheduler } from "./main/conversation-retention-scheduler.js";
import { createRemoteMcpStore } from "./main/remote-mcp-store.js";
import { createRemoteMcpAuditStore } from "./main/remote-mcp-audit-store.js";
import { createExternalDeliveryService, startExternalDeliveryScheduler } from "./main/external-delivery-service.js";
import { createHubSyncService, startHubSyncScheduler } from "./main/hub-sync-service.js";
import {
  startSmokeModelServer,
  stopSmokeModelServer,
  verifyPackagedDemoRenderer,
  verifyPackagedHubRenderer,
  verifyPackagedKnowledgeRenderer,
  verifyPackagedMcpModelRenderer,
  verifyPackagedMergeRenderer,
  verifyPackagedReconciliationRenderer,
  verifyPackagedRemoteMcpRenderer,
  verifySmokeRenderer,
} from "./main/packaged-smoke.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "bubu",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

if (started) app.quit();
if (process.platform === "win32") app.setAppUserModelId("com.squirrel.BuBu.BuBu");

let sidecars: SidecarSupervisor | undefined;
let stopWorkflowTriggerScheduler: (() => void) | undefined;
let stopDerivedRecomputeScheduler: (() => void) | undefined;
let stopReconciliationReplayScheduler: (() => void) | undefined;
let stopExternalDeliveryScheduler: (() => void) | undefined;
let stopHubSyncScheduler: (() => void) | undefined;
let stopConversationRetentionScheduler: (() => void) | undefined;
let fileArrivals: FileArrivalStore | undefined;

function registerApplicationProtocol(): void {
  const rendererRoot = join(__dirname, "..", "renderer", MAIN_WINDOW_VITE_NAME);
  protocol.handle("bubu", (request) => {
    try {
      const asset = resolveRendererAsset(rendererRoot, request.url);
      return net.fetch(pathToFileURL(asset).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function installSecurityPolicy(): void {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [contentSecurityPolicy],
      },
    });
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.on("will-navigate", (event) => event.preventDefault());
  });
}

async function createMainWindow(
  showWhenReady = true,
  initialSize: { readonly width: number; readonly height: number } = { width: 1280, height: 820 },
): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    useContentSize: true,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: "#f4f2ed",
    show: false,
    title: "BuBu",
    webPreferences: secureWebPreferences(join(__dirname, "preload.js")),
  });

  if (showWhenReady) window.once("ready-to-show", () => window.show());
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await window.loadURL("bubu://app/index.html");
  }
  return window;
}

void app
  .whenReady()
  .then(async () => {
    installSecurityPolicy();
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) registerApplicationProtocol();
    const launchMode = parseLaunchMode(process.argv, process.env, app.getPath("userData"));
    sidecars = startSidecars(launchMode.dataDirectory);
    const credentialCipher = launchMode.kind === "smoke"
      ? {
          // Packaged smoke data is synthetic and short-lived. Keeping its cipher
          // process-local prevents a headless verifier from prompting for the
          // user's macOS keychain while production continues to use safeStorage.
          isEncryptionAvailable: () => true,
          encrypt: (value: string) => Buffer.from(value, "utf8"),
          decrypt: (value: Buffer) => value.toString("utf8"),
        }
      : {
          isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
          encrypt: (value: string) => safeStorage.encryptString(value),
          decrypt: (value: Buffer) => safeStorage.decryptString(value),
        };
    const providerStore = createProviderStore({
      directory: join(launchMode.dataDirectory, "providers"),
      cipher: credentialCipher,
    });
    if (launchMode.kind === "smoke") {
      providerStore.save({
        name: "Smoke local model",
        kind: "openai-compatible",
        baseUrl: await startSmokeModelServer(),
        model: "smoke-model",
        credential: "synthetic-smoke-token",
      });
    }
    const mcpConnectionStore = createMcpConnectionStore({
      directory: join(launchMode.dataDirectory, "mcp"),
      cipher: credentialCipher,
    });
    if (launchMode.kind === "smoke") {
      mcpConnectionStore.save({
        name: "BuBu 安全演示 MCP",
        command: join(process.resourcesPath, process.platform === "win32" ? "bubu-mcp-demo.exe" : "bubu-mcp-demo"),
        args: [],
        environment: [],
      });
    }
    const mcpAuditStore = createMcpAuditStore({
      directory: join(launchMode.dataDirectory, "mcp", "audits"),
    });
    const remoteMcpStore = createRemoteMcpStore({ directory: join(launchMode.dataDirectory, "mcp-remote", "connections"), cipher: credentialCipher });
    const remoteMcpAuditStore = createRemoteMcpAuditStore(join(launchMode.dataDirectory, "mcp-remote", "audits"));
    const externalDelivery = createExternalDeliveryService({ directory: join(launchMode.dataDirectory, "external-delivery"), cipher: credentialCipher });
    const hubSync = createHubSyncService({ directory: join(launchMode.dataDirectory, "hub-sync"), cipher: credentialCipher });
    const metrics = createProductMetricsStore(join(launchMode.dataDirectory, "metrics"));
    const privacyPolicy = createPrivacyPolicyStore(join(launchMode.dataDirectory, "privacy"));
    const agentDefinitions = createAgentDefinitionStore({ directory: join(launchMode.dataDirectory, "agent-definitions") });
    const conversationRetention = createConversationRetentionStore(join(launchMode.dataDirectory, "conversation-retention"));
    const configurationBackup = createConfigurationBackupService({ privacyPolicy, conversationRetention, agentDefinitions });
    const smokeConfigurationPath = join(dirname(launchMode.dataDirectory), "smoke-settings.bubu-settings");
    fileArrivals = createFileArrivalStore({
      directory: join(launchMode.dataDirectory, "file-arrivals"),
      now: () => new Date(),
      newId: () => randomUUID().replaceAll("-", ""),
      listDatasets: () => sidecars?.listDatasets() ?? Promise.resolve([]),
      inspectSource: (sourcePath) => sidecars?.inspectSource(sourcePath) ?? Promise.reject(new Error("data core is unavailable")),
      previewDataset: (datasetId) => sidecars?.previewDataset({ datasetId, limit: 1, offset: 0 }) ?? Promise.reject(new Error("data core is unavailable")),
      onDetected: async (item) => {
        await Promise.all([
          metrics.record({ name: "file_arrival_detected", outcome: "succeeded" }),
          metrics.record({ name: item.candidates[0]?.confidence === "high" ? "file_arrival_target_suggested" : "file_arrival_review_required", outcome: "succeeded" }),
        ]).catch(() => undefined);
      },
    });
    registerDesktopApi({
      sidecars,
      providerStore,
      mcpConnectionStore,
      mcpAuditStore,
      mcpRuntimeDirectory: join(launchMode.dataDirectory, "mcp", "runtimes"),
      remoteMcpStore,
      remoteMcpAuditStore,
      metrics,
      fileArrivals,
      privacyPolicy,
      agentDefinitions,
      externalDelivery,
      hubSync,
      conversationRetention,
      configurationBackup,
      ...(launchMode.kind === "smoke" ? { configurationBackupPaths: { exportPath: smokeConfigurationPath, importPath: smokeConfigurationPath } } : {}),
      demoDirectory: join(process.resourcesPath, "demo"),
      developmentServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    });
    if (launchMode.kind === "smoke") {
      const imported = await sidecars.importFiles([launchMode.sourcePath, launchMode.secondSourcePath]);
      const smokeKnowledgePath = join(dirname(launchMode.dataDirectory), "smoke-refund-policy.md");
      await writeFile(smokeKnowledgePath, "# 退款政策\n\n退款需要订单号与购买凭证。\n申请应在购买后 30 天内提交。", { mode: 0o600 });
      await sidecars.importKnowledgeSource({ sourcePath: smokeKnowledgePath, displayName: "退款政策" });
      await sidecars.saveGroup({
        name: "synthetic-group",
        description: "每周对照订单与经营目标",
        cadence: "weekly",
        datasetIds: imported.datasets.map(({ id }) => id),
      });
      for (const dataset of imported.datasets) {
        const context = await sidecars.modelContext(dataset.id, "schema-synthetic");
        const plan = {
          schemaVersion: 1 as const,
          datasetId: dataset.id,
          versionId: dataset.versionId,
          purpose: "Smoke sum by region",
          dimensions: ["Region"],
          measures: [{ operation: "sum" as const, column: "Amount" }, { operation: "count" as const, column: null }],
          filters: [],
          sort: [{ outputIndex: 1, direction: "descending" as const }],
          limit: 10,
        };
        const target = { kind: "dataset" as const, id: dataset.id };
        const question = "Smoke sum by region";
        const thread = await sidecars.appendConversation({
          target,
          entry: { kind: "question", role: "user", payload: { question } },
        });
        await sidecars.appendConversation({
          target,
          entry: {
            kind: "plan",
            role: "assistant",
            payload: { proposal: { question, disclosedContext: context, plan } },
          },
        });
        const result = await sidecars.executeQueryPlan(plan);
        await sidecars.appendConversation({
          target,
          entry: { kind: "result", role: "assistant", payload: { result, sourcePlan: plan } },
        });
        if (dataset.displayName === "synthetic-sales") {
          const workflow = await sidecars.saveWorkflow({
            name: "每周区域销售汇总",
            target,
            threadId: thread.id,
            trigger: { kind: "interval", everyMinutes: 7 * 24 * 60 },
            timeoutMs: 60_000,
            steps: [{ id: "approved-query", kind: "dataset-query", plan, maxAttempts: 2 }],
          });
          await sidecars.runWorkflow(workflow.id, randomUUID());
        }
      }
      const smokeBackupPath = join(dirname(launchMode.dataDirectory), "smoke-restore.bubu-backup");
      await sidecars.createBackup(smokeBackupPath);
      await sidecars.deleteDataset(imported.datasets[0]?.id ?? "missing-smoke-dataset");
      await sidecars.restoreBackup(smokeBackupPath);
      const restoredDatasets = await sidecars.listDatasets();
      if (restoredDatasets.length !== imported.datasets.length) throw new Error("Packaged backup/restore smoke did not restore every dataset");
    }
    const window = await createMainWindow(
      launchMode.kind !== "smoke",
      launchMode.kind === "smoke" ? { width: 920, height: 640 } : undefined,
    );

    if (launchMode.kind === "smoke") {
      const readiness = await sidecars.readiness();
      if (readiness.status !== "ready" || window.webContents.getURL() !== "bubu://app/index.html") {
        throw new Error(`Packaged smoke check failed: ${JSON.stringify(readiness)}`);
      }
      console.log("BUBU_PACKAGED_STAGE imported-workspace");
      await verifySmokeRenderer(window, sidecars, launchMode.sourcePath, launchMode.secondSourcePath, launchMode.screenshotDirectory);
      await verifyPackagedKnowledgeRenderer(window);
      await verifyPackagedMcpModelRenderer(window);
      await verifyPackagedRemoteMcpRenderer(window);
      await verifyPackagedHubRenderer(window);
      console.log("BUBU_PACKAGED_STAGE demo-workspace");
      const smokeDatasets = await sidecars.listDatasets();
      for (const dataset of smokeDatasets) await sidecars.deleteDataset(dataset.id);
      const demoWindow = await createMainWindow(false, { width: 920, height: 640 });
      await verifyPackagedDemoRenderer(demoWindow, launchMode.screenshotDirectory);
      demoWindow.close();
      for (const dataset of await sidecars.listDatasets()) await sidecars.deleteDataset(dataset.id);
      const mergeWindow = await createMainWindow(false, { width: 920, height: 640 });
      await verifyPackagedMergeRenderer(mergeWindow, launchMode.screenshotDirectory);
      mergeWindow.close();
      for (const dataset of await sidecars.listDatasets()) await sidecars.deleteDataset(dataset.id);
      const reconciliationWindow = await createMainWindow(false, { width: 920, height: 640 });
      if (!fileArrivals) throw new Error("Packaged file-arrival store is unavailable");
      await verifyPackagedReconciliationRenderer(reconciliationWindow, sidecars, fileArrivals, launchMode.screenshotDirectory);
      console.log("BUBU_PACKAGED_IMPORT_UI_OK");
      console.log("BUBU_PACKAGED_BACKUP_RESTORE_OK");
      console.log("BUBU_PACKAGED_RETAIL_DEMO_OK");
      console.log("BUBU_PACKAGED_MERGE_OK");
      console.log("BUBU_PACKAGED_RECONCILIATION_OK");
      console.log("BUBU_PACKAGED_SMOKE_OK");
      app.quit();
      return;
    }

    stopWorkflowTriggerScheduler = startWorkflowTriggerScheduler(sidecars, {
      onError: (error) => console.warn("BuBu workflow trigger tick failed", error),
      onFinished: (event) => {
        if (!Notification.isSupported()) return;
        const body = event.status === "succeeded"
          ? "本地工作流已完成，结果已发送到当前对话。"
          : "本地工作流未完成；请查看当前对话中的记录。";
        new Notification({ title: "BuBu 工作流提醒", body }).show();
      },
    });
    stopExternalDeliveryScheduler = startExternalDeliveryScheduler(externalDelivery, (error) => console.warn("BuBu external delivery tick failed", error));
    stopHubSyncScheduler = startHubSyncScheduler(hubSync, (error) => console.warn("BuBu Hub sync tick failed", error));
    stopConversationRetentionScheduler = startConversationRetentionScheduler({
      store: conversationRetention,
      apply: (retentionDays) => sidecars?.applyConversationRetention(retentionDays) ?? Promise.reject(new Error("data core is unavailable")),
      onError: (error) => console.warn("BuBu conversation retention tick failed", error),
    });
    stopDerivedRecomputeScheduler = startDerivedRecomputeScheduler(sidecars, {
      onError: (error) => console.warn("BuBu derived recompute tick failed", error),
      onFinished: (event) => {
        if (!Notification.isSupported()) return;
        const body = event.status === "succeeded"
          ? `${event.targetDisplayName} 已基于最新上游版本完成重算。`
          : `${event.targetDisplayName} 已暂停自动重算，请在派生关系中查看并修复。`;
        new Notification({ title: "BuBu 自动重算", body }).show();
      },
    });
    stopReconciliationReplayScheduler = startReconciliationReplayScheduler(sidecars, {
      onError: (error) => console.warn("BuBu reconciliation replay tick failed", error),
      onFinished: (event) => {
        if (!Notification.isSupported()) return;
        const body = event.status === "succeeded"
          ? "受审对账已基于最新来源完成，结果证据已保存。"
          : "受审对账未自动完成；请在对应数据组中审查原因。";
        new Notification({ title: "BuBu 对账提醒", body }).show();
      },
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  })
  .catch((error: unknown) => {
    console.error("BuBu desktop startup failed", error);
    app.exit(1);
  });

app.on("before-quit", () => {
  stopSmokeModelServer();
  stopWorkflowTriggerScheduler?.();
  stopWorkflowTriggerScheduler = undefined;
  stopDerivedRecomputeScheduler?.();
  stopDerivedRecomputeScheduler = undefined;
  stopReconciliationReplayScheduler?.();
  stopReconciliationReplayScheduler = undefined;
  stopExternalDeliveryScheduler?.();
  stopExternalDeliveryScheduler = undefined;
  stopHubSyncScheduler?.();
  stopHubSyncScheduler = undefined;
  stopConversationRetentionScheduler?.();
  stopConversationRetentionScheduler = undefined;
  sidecars?.stop();
  sidecars = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
