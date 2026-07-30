import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HubAuthority } from "./authority.js";
import { PostgresHubAuthority } from "./postgres-authority.js";

const maximumBodyBytes = 512 * 1024;
async function body(request: IncomingMessage): Promise<unknown> { let value = ""; for await (const chunk of request) { value += Buffer.from(chunk).toString("utf8"); if (Buffer.byteLength(value) > maximumBodyBytes) throw new Error("Hub request body exceeds 512 KiB"); } return JSON.parse(value || "null") as unknown; }
const bearer = (request: IncomingMessage) => { const value = request.headers.authorization; if (!value?.startsWith("Bearer ") || value.length > 600) throw new Error("Hub bearer credential is missing"); return value.slice(7); };
const send = (response: ServerResponse, status: number, value: unknown) => { const json = JSON.stringify(value); response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(json), "cache-control": "no-store", "x-content-type-options": "nosniff" }); response.end(json); };

type HubAuthorityAdapter = HubAuthority | PostgresHubAuthority;
export function createHubRequestHandler(authority: HubAuthorityAdapter) { return async (request: IncomingMessage, response: ServerResponse) => { try { const url = new URL(request.url ?? "/", "http://hub.invalid"); if (request.method === "GET" && url.pathname === "/health") return send(response, 200, { status: "ready", protocolVersion: 1 }); if (request.method === "POST" && url.pathname === "/v1/bootstrap") return send(response, 201, await authority.bootstrap(await body(request))); const token = bearer(request); if (request.method === "POST" && url.pathname === "/v1/members") return send(response, 201, await authority.createMember(token, await body(request))); if (request.method === "POST" && url.pathname === "/v1/devices") return send(response, 201, await authority.createDevice(token, await body(request))); if (request.method === "POST" && /^\/v1\/members\/[a-f0-9]{32}\/revoke$/u.test(url.pathname)) return send(response, 200, await authority.revokeMember(token, url.pathname.split("/")[3]!)); if (request.method === "POST" && /^\/v1\/devices\/[a-f0-9]{32}\/revoke$/u.test(url.pathname)) return send(response, 200, await authority.revokeDevice(token, url.pathname.split("/")[3]!)); if (request.method === "POST" && url.pathname === "/v1/sync/push") return send(response, 200, await authority.push(token, await body(request))); if (request.method === "POST" && url.pathname === "/v1/sync/pull") return send(response, 200, await authority.pull(token, await body(request))); if (request.method === "GET" && url.pathname === "/v1/audit") return send(response, 200, await authority.audit(token)); send(response, 404, { error: "NOT_FOUND" }); } catch (error) { send(response, error instanceof SyntaxError ? 400 : 403, { error: "REQUEST_REJECTED", message: error instanceof Error ? error.message : "Hub request failed" }); } }; }

export function createHubServer(authority: HubAuthorityAdapter, tls?: { readonly cert: Buffer; readonly key: Buffer }) { const handler = createHubRequestHandler(authority); return tls ? createHttpsServer(tls, handler) : createHttpServer(handler); }

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const databaseUrl = process.env.BUBU_HUB_DATABASE_URL; const statePath = resolve(process.env.BUBU_HUB_STATE_PATH ?? "./var/bubu-hub/state.json"); if (!databaseUrl) mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });
  const certPath = process.env.BUBU_HUB_TLS_CERT; const keyPath = process.env.BUBU_HUB_TLS_KEY; if ((certPath === undefined) !== (keyPath === undefined)) throw new Error("Both BUBU_HUB_TLS_CERT and BUBU_HUB_TLS_KEY are required");
  const tls = certPath && keyPath ? { cert: readFileSync(resolve(certPath)), key: readFileSync(resolve(keyPath)) } : undefined;
  const host = process.env.BUBU_HUB_HOST ?? "127.0.0.1"; if (!tls && host !== "127.0.0.1" && host !== "::1") throw new Error("Non-loopback Hub requires TLS");
  const port = Number(process.env.BUBU_HUB_PORT ?? 8787); if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("BUBU_HUB_PORT is invalid");
  const authority = databaseUrl ? await PostgresHubAuthority.connect(databaseUrl) : new HubAuthority({ statePath }); const server = createHubServer(authority, tls); server.listen(port, host, () => console.log(`BuBu Hub listening on ${tls ? "https" : "http"}://${host}:${port} with ${databaseUrl ? "PostgreSQL" : "private-file"} persistence`)); const shutdown = () => server.close(() => { void (authority instanceof PostgresHubAuthority ? authority.close() : Promise.resolve()).finally(() => process.exit(0)); }); process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown);
}
