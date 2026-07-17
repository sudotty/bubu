import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  isTrustedFrameUrl,
  resolveRendererAsset,
  secureWebPreferences,
} from "./security.js";

describe("desktop security boundary", () => {
  it("trusts only the packaged app origin or the exact development origin", () => {
    expect(isTrustedFrameUrl("bubu://app/index.html")).toBe(true);
    expect(isTrustedFrameUrl("bubu://other/index.html")).toBe(false);
    expect(isTrustedFrameUrl("https://attacker.example/bubu://app")).toBe(false);
    expect(isTrustedFrameUrl("http://localhost:5173/page", "http://localhost:5173")).toBe(true);
    expect(isTrustedFrameUrl("http://localhost:5174/page", "http://localhost:5173")).toBe(false);
  });

  it("keeps Node and privilege-bearing renderer features disabled", () => {
    expect(secureWebPreferences("/tmp/preload.js")).toEqual({
      preload: "/tmp/preload.js",
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    });
  });

  it("resolves only assets contained by the packaged renderer root", () => {
    expect(resolveRendererAsset("/application/renderer", "bubu://app/index.html")).toBe(
      "/application/renderer/index.html",
    );
    expect(() =>
      resolveRendererAsset("/application/renderer", "bubu://app/%2e%2e/secrets.txt"),
    ).toThrow("outside");
    expect(() =>
      resolveRendererAsset("/application/renderer", "bubu://evil/index.html"),
    ).toThrow("origin");
  });

  it("does not permit remote scripts or dynamic evaluation", () => {
    expect(contentSecurityPolicy).toContain("default-src 'self'");
    expect(contentSecurityPolicy).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy).not.toContain("http:");
    expect(contentSecurityPolicy).not.toContain("https:");
  });
});
