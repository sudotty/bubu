import { createHash, randomUUID } from "node:crypto";
import { ipcMain, shell } from "electron";
import {
  mcpInspectionBudget,
  mcpToolCallBudget,
  canonicalMcpJson,
  parseMcpToolCallRequest,
  parseDatasetId,
  parseOperationEnvelope,
  parseRemoteMcpConnectionConfigurationInput,
  parseRemoteMcpInspectionApproval,
  parseRemoteMcpInspectionInvocation,
  parseRemoteMcpOAuthApproval,
  parseRemoteMcpToolCallApproval,
  parseRemoteMcpToolCallInvocation,
  validateMcpToolArguments,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { RemoteMcpInspectionApprovalStore } from "./remote-mcp-approval-sessions.js";
import type { RemoteMcpAuditStore } from "./remote-mcp-audit-store.js";
import type { RemoteMcpOAuthSessionStore } from "./remote-mcp-oauth-sessions.js";
import type { RemoteMcpStore } from "./remote-mcp-store.js";
import { postOAuthToken, resolvePublicRemoteTarget } from "./remote-network.js";
import type { RemoteMcpPort } from "./sidecar-ports.js";

interface Dependencies {
  readonly sidecars: RemoteMcpPort;
  readonly store: RemoteMcpStore;
  readonly oauth: RemoteMcpOAuthSessionStore;
  readonly inspections: RemoteMcpInspectionApprovalStore;
  readonly audits: RemoteMcpAuditStore;
  readonly operations: OperationRegistry;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

function profile(store: RemoteMcpStore, id: string) {
  const result = store.state().connections.find((connection) => connection.id === id);
  if (!result) throw new Error("Remote MCP connection does not exist");
  return result;
}

function parseTokenResponse(value: unknown, now: number) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("OAuth token response is invalid");
  const record = value as Record<string, unknown>;
  if (typeof record.access_token !== "string" || record.access_token.length < 1 || record.access_token.length > 16_384 || /[\0\r\n]/u.test(record.access_token)) throw new Error("OAuth access token is invalid");
  if (typeof record.token_type !== "string" || record.token_type.toLowerCase() !== "bearer") throw new Error("OAuth token type must be Bearer");
  if (record.refresh_token !== undefined && (typeof record.refresh_token !== "string" || record.refresh_token.length < 1 || record.refresh_token.length > 16_384 || /[\0\r\n]/u.test(record.refresh_token))) throw new Error("OAuth refresh token is invalid");
  if (record.expires_in !== undefined && (typeof record.expires_in !== "number" || !Number.isInteger(record.expires_in) || record.expires_in < 60 || record.expires_in > 31_536_000)) throw new Error("OAuth token expiry is invalid");
  return { tokenType: "Bearer" as const, accessToken: record.access_token, ...(record.refresh_token === undefined ? {} : { refreshToken: record.refresh_token }), ...(record.expires_in === undefined ? {} : { expiresAt: new Date(now + record.expires_in * 1_000).toISOString() }) };
}

export function registerRemoteMcpApi({ sidecars, store, oauth, inspections, audits, operations, assertTrustedSender }: Dependencies): void {
  ipcMain.handle(desktopChannels.listRemoteMcp, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return store.state(); });
  ipcMain.handle(desktopChannels.listRemoteMcpAudits, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return audits.list(); });
  ipcMain.handle(desktopChannels.saveRemoteMcp, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return store.save(parseRemoteMcpConnectionConfigurationInput(value)); });
  ipcMain.handle(desktopChannels.removeRemoteMcp, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return store.remove(parseDatasetId(value)); });
  ipcMain.handle(desktopChannels.prepareRemoteMcpOAuth, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const connection = profile(store, parseDatasetId(value));
    if (connection.authorization.kind !== "oauth-pkce") throw new Error("Remote MCP connection does not use OAuth PKCE");
    await Promise.all([resolvePublicRemoteTarget(connection.authorization.authorizationEndpoint), resolvePublicRemoteTarget(connection.authorization.tokenEndpoint)]);
    return oauth.prepare(connection);
  });
  ipcMain.handle(desktopChannels.approveRemoteMcpOAuth, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseRemoteMcpOAuthApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const connection = profile(store, approval.connectionId);
      if (connection.authorization.kind !== "oauth-pkce") throw new Error("Remote MCP OAuth configuration changed after review");
      const authorizationUrl = oauth.authorizationUrl(connection.id, approval.state);
      await resolvePublicRemoteTarget(authorizationUrl);
      await shell.openExternal(authorizationUrl);
      const callback = await oauth.wait(connection.id, approval.state, signal);
      const body = new URLSearchParams({ grant_type: "authorization_code", code: callback.code, client_id: connection.authorization.clientId, redirect_uri: callback.redirectUrl, code_verifier: callback.verifier });
      const tokenResponse = await postOAuthToken(connection.authorization.tokenEndpoint, body, signal);
      return store.saveTokens(connection.id, parseTokenResponse(tokenResponse, Date.now()));
    });
  });
  ipcMain.handle(desktopChannels.revokeRemoteMcpOAuth, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return store.revokeTokens(parseDatasetId(value)); });
  ipcMain.handle(desktopChannels.refreshRemoteMcpOAuth, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const connection = store.oauthCredentials(parseDatasetId(value));
    if (connection.profile.authorization.kind !== "oauth-pkce" || connection.refreshToken === undefined) throw new Error("Remote MCP OAuth refresh token is unavailable; authorize again");
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: connection.refreshToken, client_id: connection.profile.authorization.clientId });
    const response = parseTokenResponse(await postOAuthToken(connection.profile.authorization.tokenEndpoint, body), Date.now());
    return store.saveTokens(connection.profile.id, { ...response, refreshToken: response.refreshToken ?? connection.refreshToken });
  });
  ipcMain.handle(desktopChannels.prepareRemoteMcpInspection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const resolved = store.resolve(parseDatasetId(value));
    return inspections.issue(resolved.profile);
  });
  ipcMain.handle(desktopChannels.approveRemoteMcpInspection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseRemoteMcpInspectionApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const approved = inspections.consume(approval.approvalToken);
      const resolved = store.resolve(approved.id);
      if (JSON.stringify(resolved.profile) !== JSON.stringify(approved)) throw new Error("Remote MCP connection changed after approval");
      const resolvedAddresses = await resolvePublicRemoteTarget(resolved.profile.serverUrl);
      const invocation = parseRemoteMcpInspectionInvocation({ connectionId: resolved.profile.id, serverUrl: resolved.profile.serverUrl, resolvedAddresses, ...(resolved.accessToken === undefined ? {} : { authorizationBearer: resolved.accessToken }), budget: mcpInspectionBudget });
      const auditId = randomUUID(); const startedAt = new Date().toISOString();
      audits.start({ auditId, connectionId: resolved.profile.id, connectionName: resolved.profile.name, operation: "remote-inspect", endpointOrigin: new URL(resolved.profile.serverUrl).origin, requestFingerprint: createHash("sha256").update(canonicalMcpJson({ serverUrl: resolved.profile.serverUrl, budget: mcpInspectionBudget })).digest("hex"), startedAt });
      try { const result = await sidecars.inspectRemoteMcp(invocation, signal); audits.finish({ auditId, status: "succeeded", completedAt: new Date().toISOString(), contentParts: result.tools.length + result.resources.length + result.prompts.length, decodedBytes: Buffer.byteLength(JSON.stringify(result)) }); return result; }
      catch (error) { audits.finish({ auditId, status: "failed", completedAt: new Date().toISOString(), errorCode: signal.aborted ? "CANCELLED" : "REMOTE_INSPECTION_FAILED" }); throw error; }
    });
  });
  ipcMain.handle(desktopChannels.dismissRemoteMcpInspection, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); inspections.revoke(parseRemoteMcpInspectionApproval(value).approvalToken); });
  ipcMain.handle(desktopChannels.prepareRemoteMcpTool, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const request = parseMcpToolCallRequest(value);
    validateMcpToolArguments(request.inputSchemaJson, request.arguments);
    const resolved = store.resolve(request.connectionId);
    return inspections.issueTool(resolved.profile, request);
  });
  ipcMain.handle(desktopChannels.approveRemoteMcpTool, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value); const approval = parseRemoteMcpToolCallApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const approved = inspections.consumeTool(approval.approvalToken);
      if (JSON.stringify(approved.request) !== JSON.stringify(approval.request)) throw new Error("Remote MCP tool request changed after approval");
      const resolved = store.resolve(approved.profile.id);
      if (JSON.stringify(resolved.profile) !== JSON.stringify(approved.profile)) throw new Error("Remote MCP connection changed after approval");
      const resolvedAddresses = await resolvePublicRemoteTarget(resolved.profile.serverUrl);
      const invocation = parseRemoteMcpToolCallInvocation({ connectionId: resolved.profile.id, serverUrl: resolved.profile.serverUrl, resolvedAddresses, ...(resolved.accessToken === undefined ? {} : { authorizationBearer: resolved.accessToken }), toolName: approved.request.toolName, inputSchemaSha256: createHash("sha256").update(approved.request.inputSchemaJson).digest("hex"), taskSupport: approved.request.taskSupport, arguments: approved.request.arguments, budget: mcpToolCallBudget });
      const auditId = randomUUID(); const inputKeys = Object.keys(approved.request.arguments).sort(); const inputBytes = Buffer.byteLength(canonicalMcpJson(approved.request.arguments));
      audits.start({ auditId, connectionId: resolved.profile.id, connectionName: resolved.profile.name, operation: "remote-tool-call", endpointOrigin: new URL(resolved.profile.serverUrl).origin, requestFingerprint: createHash("sha256").update(canonicalMcpJson({ serverUrl: resolved.profile.serverUrl, toolName: approved.request.toolName, inputSchemaSha256: invocation.inputSchemaSha256, inputKeys, inputBytes })).digest("hex"), toolName: approved.request.toolName, inputSchemaSha256: invocation.inputSchemaSha256, inputKeys, inputBytes, startedAt: new Date().toISOString() });
      try { const result = await sidecars.callRemoteMcpTool(invocation, signal); audits.finish({ auditId, status: "succeeded", completedAt: new Date().toISOString(), contentParts: result.contents.length, decodedBytes: result.decodedBytes }); return result; }
      catch (error) { audits.finish({ auditId, status: "failed", completedAt: new Date().toISOString(), errorCode: signal.aborted ? "CANCELLED" : "REMOTE_TOOL_CALL_FAILED" }); throw error; }
    });
  });
  ipcMain.handle(desktopChannels.dismissRemoteMcpTool, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); inspections.revoke(parseRemoteMcpToolCallApproval(value).approvalToken); });
}
