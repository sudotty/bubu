import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRemoteMcpStore } from "./remote-mcp-store.js";

const cipher = { isEncryptionAvailable: () => true, encrypt: (value: string) => Buffer.from(`enc:${value}`), decrypt: (value: Buffer) => value.toString().startsWith("enc:") ? value.subarray(4).toString() : "" };
const oauth = { kind: "oauth-pkce" as const, authorizationEndpoint: "https://auth.example.com/authorize", tokenEndpoint: "https://auth.example.com/token", clientId: "bubu", scopes: ["mcp.read"] };

describe("remote MCP store", () => {
  it("keeps tokens encrypted and never returns them in public state", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-remote-mcp-"));
    const store = createRemoteMcpStore({ directory, cipher, createId: () => "a".repeat(32), now: () => Date.parse("2026-07-29T00:00:00Z") });
    store.save({ name: "Remote", serverUrl: "https://mcp.example.com/rpc", authorization: oauth });
    expect(store.state().connections[0]?.authorizationStatus).toBe("disconnected");
    store.saveTokens("a".repeat(32), { tokenType: "Bearer", accessToken: "access-secret", refreshToken: "refresh-secret", expiresAt: "2026-07-30T00:00:00Z" });
    expect(JSON.stringify(store.state())).not.toContain("secret");
    expect(store.resolve("a".repeat(32)).accessToken).toBe("access-secret");
    expect(store.oauthCredentials("a".repeat(32)).refreshToken).toBe("refresh-secret");
    store.revokeTokens("a".repeat(32));
    expect(() => store.resolve("a".repeat(32))).toThrow("required");
  });

  it("exposes expired refresh credentials only to the main-process adapter", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-remote-mcp-expired-"));
    const store = createRemoteMcpStore({ directory, cipher, createId: () => "b".repeat(32), now: () => Date.parse("2026-07-29T00:00:00Z") });
    store.save({ name: "Remote", serverUrl: "https://mcp.example.com/rpc", authorization: oauth });
    store.saveTokens("b".repeat(32), { tokenType: "Bearer", accessToken: "old-access", refreshToken: "refresh-secret", expiresAt: "2026-07-28T00:00:00Z" });
    expect(store.state().connections[0]?.authorizationStatus).toBe("expired");
    expect(() => store.resolve("b".repeat(32))).toThrow("expired");
    expect(store.oauthCredentials("b".repeat(32)).refreshToken).toBe("refresh-secret");
  });
});
