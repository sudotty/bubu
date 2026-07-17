import { randomUUID } from "node:crypto";
import { ipcMain } from "electron";
import {
  mcpResourceReadBudget,
  parseMcpResourceReadApproval,
  parseMcpResourceReadInvocation,
  parseMcpResourceReadRequest,
  parseOperationEnvelope,
  type McpResourceReadInvocation,
  type McpResourceReadResult,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { McpAuditStore } from "./mcp-audit-store.js";
import type { McpConnectionStore, ResolvedMcpConnection } from "./mcp-connection-store.js";
import type { McpResourceApprovalSessionStore } from "./mcp-resource-approval-sessions.js";
import { prepareMcpInspectionInvocation } from "./mcp-api.js";
import { RpcRemoteError } from "./rpc-broker.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface McpResourceExecutionDependencies {
  readonly connections: Pick<McpConnectionStore, "resolve">;
  readonly approvals: McpResourceApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly runtimeDirectory: string;
  readonly read: (invocation: McpResourceReadInvocation, signal: AbortSignal) => Promise<McpResourceReadResult>;
  readonly now: () => string;
  readonly newAuditId: () => string;
}

export function prepareMcpResourceReadInvocation(
  resolved: ResolvedMcpConnection,
  runtimeDirectory: string,
  resourceUri: string,
): McpResourceReadInvocation {
  const launch = prepareMcpInspectionInvocation(resolved, runtimeDirectory);
  return parseMcpResourceReadInvocation({
    connectionId: launch.connectionId,
    command: launch.command,
    args: launch.args,
    environment: launch.environment,
    workingDirectory: launch.workingDirectory,
    resourceUri,
    budget: mcpResourceReadBudget,
  });
}

function auditErrorCode(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "CANCELLED";
  if (error instanceof RpcRemoteError && /^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code)) return error.code;
  return "MCP_RESOURCE_READ_FAILED";
}

export async function executeApprovedMcpResourceRead(
  approvalToken: string,
  signal: AbortSignal,
  dependencies: McpResourceExecutionDependencies,
): Promise<McpResourceReadResult> {
  const approved = dependencies.approvals.consume(approvalToken);
  const resolved = dependencies.connections.resolve(approved.connectionId);
  const invocation = prepareMcpResourceReadInvocation(
    resolved,
    dependencies.runtimeDirectory,
    approved.resourceUri,
  );
  if (!dependencies.approvals.matches(approved, resolved.profile.name, invocation)) {
    throw new Error("MCP 连接或资源请求在批准后发生变化，请重新审查精确读取内容");
  }
  if (signal.aborted) throw new Error("MCP resource read was cancelled before launch");

  const auditId = dependencies.newAuditId();
  dependencies.audits.start({
    auditId,
    connectionId: invocation.connectionId,
    connectionName: resolved.profile.name,
    operation: "resource-read",
    resourceUri: invocation.resourceUri,
    requestFingerprint: approved.requestFingerprint,
    startedAt: dependencies.now(),
  });
  let result: McpResourceReadResult;
  try {
    result = await dependencies.read(invocation, signal);
  } catch (error) {
    dependencies.audits.finish({
      auditId,
      status: "failed",
      completedAt: dependencies.now(),
      errorCode: auditErrorCode(error, signal),
    });
    throw error;
  }
  dependencies.audits.finish({
    auditId,
    status: "succeeded",
    completedAt: dependencies.now(),
    contentParts: result.contents.length,
    decodedBytes: result.decodedBytes,
  });
  return result;
}

interface McpResourceApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly connections: McpConnectionStore;
  readonly approvals: McpResourceApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly operations: OperationRegistry;
  readonly runtimeDirectory: string;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

export function registerMcpResourceApi({
  sidecars,
  connections,
  approvals,
  audits,
  operations,
  runtimeDirectory,
  assertTrustedSender,
}: McpResourceApiDependencies): void {
  ipcMain.handle(desktopChannels.listMcpAudits, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return audits.list();
  });
  ipcMain.handle(desktopChannels.prepareMcpResourceRead, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const request = parseMcpResourceReadRequest(value);
    const resolved = connections.resolve(request.connectionId);
    return approvals.issue(
      resolved.profile.name,
      prepareMcpResourceReadInvocation(resolved, runtimeDirectory, request.resourceUri),
    );
  });
  ipcMain.handle(desktopChannels.approveMcpResourceRead, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpResourceReadApproval(envelope.value);
    return operations.run(envelope.operationId, (signal) => executeApprovedMcpResourceRead(
      approval.approvalToken,
      signal,
      {
        connections,
        approvals,
        audits,
        runtimeDirectory,
        read: (invocation, readSignal) => sidecars.readMcpResource(invocation, readSignal),
        now: () => new Date().toISOString(),
        newAuditId: randomUUID,
      },
    ));
  });
  ipcMain.handle(desktopChannels.dismissMcpResourceRead, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    approvals.revoke(parseMcpResourceReadApproval(value).approvalToken);
  });
}
