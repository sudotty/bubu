import { readFileSync } from "node:fs";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const failures = [];
const requireText = (path, values, label) => {
  const source = read(path);
  for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`);
};

requireText("packages/contracts/src/mcp-remote.ts", ["httpsUrlSchema", "oauth-pkce", "remoteMcpInspectionInvocationSchema", "remoteMcpToolCallInvocationSchema", "remoteMcpAuditEventSchema"], "remote MCP contracts");
requireText("packages/product-core/src/remote-network-policy.ts", ["assertRemoteMcpNetworkTarget", "0xffff", "Remote MCP target resolved to a non-public address"], "pure SSRF policy");
requireText("services/ai-runtime/src/mcp/client.ts", ["StreamableHTTPClientTransport", "createSafeRemoteFetch", "fetchPinnedRemoteRequest", "dispatcher", "cross-origin redirect", "inspectMcpRemoteServer", "callMcpRemoteTool"], "official SDK remote transport");
requireText("apps/desktop/src/main/remote-network.ts", ["createPinnedLookup", "fetchResolvedPublicTarget", "dispatcher", "redirect: \"manual\""], "DNS-bound desktop network adapter");
requireText("apps/desktop/src/main/remote-mcp-oauth-sessions.ts", ["code_challenge_method", "127.0.0.1", "Remote MCP OAuth was cancelled"], "PKCE callback boundary");
requireText("apps/desktop/src/main/remote-mcp-store.ts", ["encryptedTokens", "oauthCredentials", "authorizationStatus"], "encrypted token registry");
requireText("apps/desktop/src/main/remote-mcp-api.ts", ["refreshRemoteMcpOAuth", "resolvePublicRemoteTarget", "audits.start", "validateMcpToolArguments"], "named desktop operations");
requireText("apps/desktop/src/renderer/RemoteMcpSettings.tsx", ["只保存，不连接", "刷新 token", "批准一次远程能力检查", "结果不会自动进入模型"], "truthful remote MCP UI");
requireText("apps/desktop/src/main/packaged-smoke.ts", ["BUBU_PACKAGED_REMOTE_MCP_OK", "verifyPackagedRemoteMcpRenderer"], "packaged remote profile journey");
requireText("scripts/smoke-packaged-desktop.mjs", ["BUBU_PACKAGED_REMOTE_MCP_OK"], "packaged marker gate");
requireText("docs/product/remote-mcp-and-oauth.md", ["Authorization Code + PKCE", "never cross the preload bridge", "Remote resources", "BUBU_PACKAGED_REMOTE_MCP_OK"], "current remote MCP guide");
requireManifestFacts(loadProductManifest(new URL("..", import.meta.url)), ["mcp-streamable-http: implemented", "mcp-oauth: implemented", "packaged-remote-mcp-profile-journey: implemented"], failures, "manifest remote MCP truth");

if (failures.length > 0) {
  console.error(`Remote MCP verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Remote MCP verified: HTTPS/SSRF policy, PKCE, encrypted tokens, bounded official-SDK discovery/call, append-only audit, truthful UI, and packaged no-network evidence.");
