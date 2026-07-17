import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  safeStorage,
  session,
} from "electron";
import {
  parseDatasetId,
  parseDatasetPreviewRequest,
  parseProviderConfigurationInput,
  parseProviderConnectionResult,
  parseProviderId,
} from "@bubu/contracts";
import started from "electron-squirrel-startup";
import { desktopChannels } from "./shared/product-api.js";
import {
  contentSecurityPolicy,
  isTrustedFrameUrl,
  resolveRendererAsset,
  secureWebPreferences,
} from "./main/security.js";
import { parseLaunchMode } from "./main/launch-mode.js";
import { startSidecars, type SidecarSupervisor } from "./main/sidecars.js";
import { createProviderStore, type ProviderStore } from "./main/provider-store.js";

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

function registerDesktopApi(providerStore: ProviderStore): void {
  const assertTrustedSender = (frameUrl: string) => {
    if (!isTrustedFrameUrl(frameUrl, MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
      throw new Error("Untrusted renderer attempted to call the desktop API");
    }
  };

  ipcMain.handle(desktopChannels.getReadiness, (event) => {
    const frameUrl = event.senderFrame?.url ?? "";
    assertTrustedSender(frameUrl);
    if (!sidecars) throw new Error("Desktop services have not started");
    return sidecars.readiness();
  });
  ipcMain.handle(desktopChannels.listDatasets, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    if (!sidecars) throw new Error("Desktop services have not started");
    return sidecars.listDatasets();
  });
  ipcMain.handle(desktopChannels.importDatasets, async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    if (!sidecars) throw new Error("Desktop services have not started");
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
    if (!sidecars) throw new Error("Desktop services have not started");
    return sidecars.previewDataset(parseDatasetPreviewRequest(value));
  });
  ipcMain.handle(desktopChannels.replaceDataset, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    if (!sidecars) throw new Error("Desktop services have not started");
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
    if (!sidecars) throw new Error("Desktop services have not started");
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

async function verifySmokeRenderer(window: BrowserWindow): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const expected = [
        "synthetic-sales",
        "3 行 · 4 列",
        "Order ID",
        "001",
        "128.50",
        "文本",
        "数值",
        "日期时间",
        "替换数据版本"
      ];
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
  if (!result.ok) {
    throw new Error(`Packaged renderer is missing imported data: ${result.missing.join(", ")}`);
  }
  const settingsResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const settingsButton = document.querySelector('button[title="模型设置"]');
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
}

void app
  .whenReady()
  .then(async () => {
    installSecurityPolicy();
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) registerApplicationProtocol();
    const launchMode = parseLaunchMode(process.argv, process.env, app.getPath("userData"));
    sidecars = startSidecars(launchMode.dataDirectory);
    const providerStore = createProviderStore({
      directory: join(launchMode.dataDirectory, "providers"),
      cipher: {
        isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
        encrypt: (value) => safeStorage.encryptString(value),
        decrypt: (value) => safeStorage.decryptString(value),
      },
    });
    registerDesktopApi(providerStore);
    if (launchMode.kind === "smoke") await sidecars.importFiles([launchMode.sourcePath]);
    const window = await createMainWindow(launchMode.kind !== "smoke");

    if (launchMode.kind === "smoke") {
      const readiness = await sidecars.readiness();
      if (readiness.status !== "ready" || window.webContents.getURL() !== "bubu://app/index.html") {
        throw new Error(`Packaged smoke check failed: ${JSON.stringify(readiness)}`);
      }
      await verifySmokeRenderer(window);
      console.log("BUBU_PACKAGED_IMPORT_UI_OK");
      console.log("BUBU_PACKAGED_SMOKE_OK");
      app.quit();
      return;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  })
  .catch((error: unknown) => {
    console.error("BuBu desktop startup failed", error);
    app.exit(1);
  });

app.on("before-quit", () => {
  sidecars?.stop();
  sidecars = undefined;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
