import { describe, expect, it } from "vitest";
import { createRemoteMcpOAuthSessionStore } from "./remote-mcp-oauth-sessions.js";

const profile = { id: "a".repeat(32), name: "Remote", serverUrl: "https://mcp.example.com/rpc", authorization: { kind: "oauth-pkce" as const, authorizationEndpoint: "https://auth.example.com/authorize", tokenEndpoint: "https://auth.example.com/token", clientId: "bubu", scopes: ["mcp.read"] }, authorizationStatus: "disconnected" as const };

describe("remote MCP OAuth PKCE sessions", () => {
  it("binds state, loopback redirect, and one verifier to one callback", async () => {
    const store = createRemoteMcpOAuthSessionStore({ now: () => Date.parse("2026-07-29T00:00:00Z") });
    const proposal = await store.prepare(profile);
    const authorization = new URL(proposal.authorizationUrl);
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("state")).toBe(proposal.state);
    expect(authorization.searchParams.get("redirect_uri")).toBe(proposal.redirectUrl);
    await fetch(`${proposal.redirectUrl}?state=${proposal.state}&code=one-time-code`);
    const callback = await store.wait(profile.id, proposal.state);
    expect(callback).toMatchObject({ code: "one-time-code", redirectUrl: proposal.redirectUrl });
    expect(callback.verifier.length).toBeGreaterThan(40);
    expect(() => store.authorizationUrl(profile.id, proposal.state)).toThrow("expired");
  });

  it("rejects wrong connection and state", async () => {
    const store = createRemoteMcpOAuthSessionStore({ now: () => Date.parse("2026-07-29T00:00:00Z") });
    const proposal = await store.prepare(profile);
    expect(() => store.authorizationUrl("b".repeat(32), proposal.state)).toThrow("does not match");
    store.revoke(proposal.state);
  });

  it("closes an already-cancelled callback without waiting", async () => {
    const store = createRemoteMcpOAuthSessionStore({ now: () => Date.parse("2026-07-29T00:00:00Z") });
    const proposal = await store.prepare(profile);
    const controller = new AbortController();
    controller.abort();
    await expect(store.wait(profile.id, proposal.state, controller.signal)).rejects.toThrow("cancelled");
    expect(() => store.authorizationUrl(profile.id, proposal.state)).toThrow("expired");
  });
});
