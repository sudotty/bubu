import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  session,
} from "electron";
import started from "electron-squirrel-startup";
import { desktopChannels } from "./shared/product-api.js";
import {
  contentSecurityPolicy,
  isTrustedFrameUrl,
  resolveRendererAsset,
  secureWebPreferences,
} from "./main/security.js";
import { startSidecars, type SidecarSupervisor } from "./main/sidecars.js";

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

function registerDesktopApi(): void {
  ipcMain.handle(desktopChannels.getReadiness, (event) => {
    const frameUrl = event.senderFrame?.url ?? "";
    if (!isTrustedFrameUrl(frameUrl, MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
      throw new Error("Untrusted renderer attempted to call the desktop API");
    }
    if (!sidecars) throw new Error("Desktop services have not started");
    return sidecars.readiness();
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

void app
  .whenReady()
  .then(async () => {
    installSecurityPolicy();
    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) registerApplicationProtocol();
    sidecars = startSidecars();
    registerDesktopApi();
    const smokeTest = process.argv.includes("--bubu-smoke-test");
    const window = await createMainWindow(!smokeTest);

    if (smokeTest) {
      const readiness = await sidecars.readiness();
      if (readiness.status !== "ready" || window.webContents.getURL() !== "bubu://app/index.html") {
        throw new Error(`Packaged smoke check failed: ${JSON.stringify(readiness)}`);
      }
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
