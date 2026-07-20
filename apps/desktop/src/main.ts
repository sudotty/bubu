import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import {
  app,
  BrowserWindow,
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
import { createMcpConnectionStore } from "./main/mcp-connection-store.js";
import { createMcpAuditStore } from "./main/mcp-audit-store.js";

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

let sidecars: SidecarSupervisor | undefined;
let stopWorkflowTriggerScheduler: (() => void) | undefined;

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

async function createMainWindow(showWhenReady = true): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
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

async function captureSmokeStep(
  window: BrowserWindow,
  screenshotDirectory: string | undefined,
  fileName: string,
): Promise<void> {
  if (!screenshotDirectory) return;
  await mkdir(screenshotDirectory, { recursive: true });
  const image = await window.webContents.capturePage();
  await writeFile(join(screenshotDirectory, fileName), image.toPNG(), { mode: 0o600 });
}

async function verifySmokeRenderer(
  window: BrowserWindow,
  screenshotDirectory?: string,
): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const expected = [
        "synthetic-sales",
        "3 行 · 4 列",
        "替换数据版本",
        "数据对话",
        "本地任务状态",
        "LOCAL ARTIFACT",
        "先生成计划",
        "LOCAL CONVERSATION HISTORY",
        "结果已准备好"
      ];
      const deadline = Date.now() + 5000;
      let selectedSales = false;
      const inspect = () => {
        if (!selectedSales) {
          const salesButton = Array.from(document.querySelectorAll("button.contact-card"))
            .find((button) => button.textContent?.includes("synthetic-sales"));
          if (salesButton instanceof HTMLButtonElement) {
            selectedSales = true;
            salesButton.click();
            setTimeout(inspect, 50);
            return;
          }
        }
        const contents = document.body.textContent ?? "";
        const visibleContents = document.body.innerText;
        const missing = expected.filter((value) => !contents.includes(value));
        const loading = ["正在读取本地预览与列画像…", "正在生成本地质量报告…"]
          .filter((value) => visibleContents.includes(value));
        if (missing.length === 0 && loading.length === 0) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!result.ok) {
    throw new Error(`Packaged renderer is missing imported data: ${result.missing.join(", ")}`);
  }
  await captureSmokeStep(window, screenshotDirectory, "01-datasets.png");
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const composer = document.querySelector(".analysis-composer");
      const conversation = document.querySelector(".conversation-stage");
      window.scrollTo({ top: 0 });
      if (composer instanceof HTMLElement && conversation instanceof HTMLElement) {
        conversation.scrollTop = composer.offsetTop - (conversation.clientHeight - composer.clientHeight) / 2;
      }
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    })
  `);
  await captureSmokeStep(window, screenshotDirectory, "02-chat.png");
  const groupResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const groupButton = document.querySelector('button[title="数据群组"]');
      if (!(groupButton instanceof HTMLButtonElement)) {
        return resolve({ ok: false, missing: ["数据群组按钮"] });
      }
      groupButton.click();
      const expected = ["synthetic-group", "2 个数据联系人", "群组只保存成员关系", "先生成关联计划"];
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const contents = document.body.innerText;
        const missing = expected.filter((value) => !contents.includes(value));
        if (missing.length === 0) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!groupResult.ok) {
    throw new Error(`Packaged renderer is missing dataset groups: ${groupResult.missing.join(", ")}`);
  }
  await captureSmokeStep(window, screenshotDirectory, "02-groups.png");
  const settingsResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const settingsButton = document.querySelector('button[title="设置"]');
      if (!(settingsButton instanceof HTMLButtonElement)) {
        return resolve({ ok: false, missing: ["模型设置按钮"] });
      }
      settingsButton.click();
      const expected = ["模型提供商", "添加模型", "Base URL", "模型名称", "API 密钥", "安全保存配置"];
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const contents = document.body.innerText;
        const missing = expected.filter((value) => !contents.includes(value));
        if (missing.length === 0) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!settingsResult.ok) {
    throw new Error(`Packaged renderer is missing provider settings: ${settingsResult.missing.join(", ")}`);
  }
  await captureSmokeStep(window, screenshotDirectory, "03-settings.png");
}

void app
  .whenReady()
  .then(async () => {
    installSecurityPolicy();
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) registerApplicationProtocol();
    const launchMode = parseLaunchMode(process.argv, process.env, app.getPath("userData"));
    sidecars = startSidecars(launchMode.dataDirectory);
    const credentialCipher = {
      isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
      encrypt: (value: string) => safeStorage.encryptString(value),
      decrypt: (value: Buffer) => safeStorage.decryptString(value),
    };
    const providerStore = createProviderStore({
      directory: join(launchMode.dataDirectory, "providers"),
      cipher: credentialCipher,
    });
    const mcpConnectionStore = createMcpConnectionStore({
      directory: join(launchMode.dataDirectory, "mcp"),
      cipher: credentialCipher,
    });
    const mcpAuditStore = createMcpAuditStore({
      directory: join(launchMode.dataDirectory, "mcp", "audits"),
    });
    registerDesktopApi({
      sidecars,
      providerStore,
      mcpConnectionStore,
      mcpAuditStore,
      mcpRuntimeDirectory: join(launchMode.dataDirectory, "mcp", "runtimes"),
      developmentServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    });
    if (launchMode.kind === "smoke") {
      const imported = await sidecars.importFiles([launchMode.sourcePath, launchMode.secondSourcePath]);
      await sidecars.saveGroup({
        name: "synthetic-group",
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
          measures: [{ operation: "sum" as const, column: "Amount" }],
          filters: [],
          sort: [{ outputIndex: 1, direction: "descending" as const }],
          limit: 10,
        };
        const target = { kind: "dataset" as const, id: dataset.id };
        const question = "Smoke sum by region";
        await sidecars.appendConversation({
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
      }
    }
    const window = await createMainWindow(launchMode.kind !== "smoke");

    if (launchMode.kind === "smoke") {
      const readiness = await sidecars.readiness();
      if (readiness.status !== "ready" || window.webContents.getURL() !== "bubu://app/index.html") {
        throw new Error(`Packaged smoke check failed: ${JSON.stringify(readiness)}`);
      }
      await verifySmokeRenderer(window, launchMode.screenshotDirectory);
      console.log("BUBU_PACKAGED_IMPORT_UI_OK");
      console.log("BUBU_PACKAGED_SMOKE_OK");
      app.quit();
      return;
    }

    stopWorkflowTriggerScheduler = startWorkflowTriggerScheduler(sidecars, {
      onError: (error) => console.warn("BuBu workflow trigger tick failed", error),
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
  stopWorkflowTriggerScheduler?.();
  stopWorkflowTriggerScheduler = undefined;
  sidecars?.stop();
  sidecars = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
