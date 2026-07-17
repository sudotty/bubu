import { resolve, sep } from "node:path";
import type { WebPreferences } from "electron";

export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join("; ");

export function secureWebPreferences(preload: string): WebPreferences {
  return {
    preload,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
  };
}

export function isTrustedFrameUrl(frameUrl: string, developmentOrigin?: string): boolean {
  try {
    const url = new URL(frameUrl);
    if (url.protocol === "bubu:" && url.hostname === "app") return true;
    return developmentOrigin !== undefined && url.origin === new URL(developmentOrigin).origin;
  } catch {
    return false;
  }
}

export function resolveRendererAsset(rendererRoot: string, requestUrl: string): string {
  const url = new URL(requestUrl);
  if (url.protocol !== "bubu:" || url.hostname !== "app") {
    throw new Error("Renderer request has an untrusted origin");
  }

  const applicationOrigin = "bubu://app";
  if (requestUrl !== applicationOrigin && !requestUrl.startsWith(`${applicationOrigin}/`)) {
    throw new Error("Renderer request has an untrusted origin");
  }
  const rawPath = requestUrl
    .slice(applicationOrigin.length)
    .split(/[?#]/u, 1)[0] ?? "";
  const decodedPath = decodeURIComponent(rawPath);
  const relativePath = decodedPath.replace(/^\/+/, "") || "index.html";
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === ".." || segment.includes("\\") || segment.includes("\0"))) {
    throw new Error("Renderer asset resolves outside the application root");
  }

  const absoluteRoot = resolve(rendererRoot);
  const candidate = resolve(absoluteRoot, ...segments);
  if (candidate !== absoluteRoot && !candidate.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error("Renderer asset resolves outside the application root");
  }
  return candidate;
}
