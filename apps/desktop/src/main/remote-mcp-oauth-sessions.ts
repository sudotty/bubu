import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { parseRemoteMcpOAuthStartProposal, type RemoteMcpConnectionProfile, type RemoteMcpOAuthStartProposal } from "@bubu/contracts";

const lifetimeMilliseconds = 10 * 60 * 1_000;
interface Callback { readonly code: string }
interface Pending {
  readonly connectionId: string;
  readonly state: string;
  readonly verifier: string;
  readonly redirectUrl: string;
  readonly authorizationUrl: string;
  readonly expiresAt: number;
  readonly server: Server;
  readonly callback: Promise<Callback>;
}
export interface ApprovedOAuthCallback extends Callback { readonly verifier: string; readonly redirectUrl: string }
export interface RemoteMcpOAuthSessionStore {
  prepare(profile: RemoteMcpConnectionProfile): Promise<RemoteMcpOAuthStartProposal>;
  wait(connectionId: string, state: string, signal?: AbortSignal): Promise<ApprovedOAuthCallback>;
  authorizationUrl(connectionId: string, state: string): string;
  revoke(state: string): void;
}

export function createRemoteMcpOAuthSessionStore(options: { readonly now: () => number }): RemoteMcpOAuthSessionStore {
  const pending = new Map<string, Pending>();
  return {
    async prepare(profile) {
      if (profile.authorization.kind !== "oauth-pkce") throw new Error("Remote MCP connection does not use OAuth PKCE");
      for (const [state, session] of pending) if (session.expiresAt <= options.now()) { session.server.close(); pending.delete(state); }
      if (pending.size >= 10) throw new Error("Too many pending remote MCP OAuth sessions");
      const state = randomBytes(32).toString("hex");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      let complete!: (value: Callback) => void;
      let fail!: (error: Error) => void;
      const callback = new Promise<Callback>((resolve, reject) => { complete = resolve; fail = reject; });
      const server = createServer((request, response) => {
        try {
          const url = new URL(request.url ?? "/", "http://127.0.0.1");
          if (request.method !== "GET" || url.pathname !== "/callback" || url.searchParams.get("state") !== state) throw new Error("OAuth callback state or path is invalid");
          const code = url.searchParams.get("code");
          if (!code || code.length > 8_192) throw new Error("OAuth callback code is invalid");
          response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
          response.end("BuBu authorization received. You can close this tab.");
          complete({ code });
        } catch (error) {
          response.writeHead(400, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
          response.end("BuBu rejected this authorization callback.");
          fail(error instanceof Error ? error : new Error("OAuth callback failed"));
        }
      });
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
      const port = (server.address() as AddressInfo).port;
      const redirectUrl = `http://127.0.0.1:${port}/callback`;
      const authorizationUrl = new URL(profile.authorization.authorizationEndpoint);
      authorizationUrl.searchParams.set("response_type", "code");
      authorizationUrl.searchParams.set("client_id", profile.authorization.clientId);
      authorizationUrl.searchParams.set("redirect_uri", redirectUrl);
      authorizationUrl.searchParams.set("state", state);
      authorizationUrl.searchParams.set("code_challenge", challenge);
      authorizationUrl.searchParams.set("code_challenge_method", "S256");
      if (profile.authorization.scopes.length > 0) authorizationUrl.searchParams.set("scope", profile.authorization.scopes.join(" "));
      const expiresAt = options.now() + lifetimeMilliseconds;
      pending.set(state, { connectionId: profile.id, state, verifier, redirectUrl, authorizationUrl: authorizationUrl.toString(), expiresAt, server, callback });
      return parseRemoteMcpOAuthStartProposal({ connectionId: profile.id, authorizationUrl: authorizationUrl.toString(), redirectUrl, state, expiresAt: new Date(expiresAt).toISOString(), warning: "external-browser-oauth-pkce" });
    },
    async wait(connectionId, state, signal) {
      const session = pending.get(state);
      if (!session || session.connectionId !== connectionId || session.expiresAt <= options.now()) throw new Error("Remote MCP OAuth session expired or does not match");
      if (signal?.aborted) {
        pending.delete(state);
        session.server.close();
        throw new Error("Remote MCP OAuth was cancelled");
      }
      try {
        const callback = await Promise.race([session.callback, new Promise<never>((_, reject) => signal?.addEventListener("abort", () => reject(new Error("Remote MCP OAuth was cancelled")), { once: true }))]);
        return { ...callback, verifier: session.verifier, redirectUrl: session.redirectUrl };
      } finally {
        pending.delete(state);
        session.server.close();
      }
    },
    authorizationUrl(connectionId, state) {
      const session = pending.get(state);
      if (!session || session.connectionId !== connectionId || session.expiresAt <= options.now()) throw new Error("Remote MCP OAuth session expired or does not match");
      return session.authorizationUrl;
    },
    revoke(state) { const session = pending.get(state); pending.delete(state); session?.server.close(); },
  };
}
