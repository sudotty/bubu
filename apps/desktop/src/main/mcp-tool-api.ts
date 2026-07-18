import { createHash, randomUUID } from "node:crypto";
import { ipcMain } from "electron";
import {
  mcpToolCallBudget,
  parseMcpToolCallApproval,
  parseMcpToolCallInvocation,
  parseMcpToolCallRequest,
  parseOperationEnvelope,
  type McpToolCallInvocation,
  type McpToolCallRequest,
  type McpToolCallResult,
  validateMcpToolArguments,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { McpAuditStore } from "./mcp-audit-store.js";
import type { McpConnectionStore, ResolvedMcpConnection } from "./mcp-connection-store.js";
import type { McpToolApprovalSessionStore } from "./mcp-tool-approval-sessions.js";
import { prepareMcpInspectionInvocation } from "./mcp-api.js";
import type { OperationRegistry } from "./operation-registry.js";
import { RpcRemoteError } from "./rpc-broker.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface McpToolExecutionDependencies {
  readonly connections: Pick<McpConnectionStore, "resolve">;
  readonly approvals: McpToolApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly runtimeDirectory: string;
  readonly call: (invocation: McpToolCallInvocation, signal: AbortSignal) => Promise<McpToolCallResult>;
  readonly now: () => string;
  readonly newAuditId: () => string;
}

export function prepareMcpToolCallInvocation(
  resolved: ResolvedMcpConnection,
  runtimeDirectory: string,
  requestValue: McpToolCallRequest,
): McpToolCallInvocation {
  const request = parseMcpToolCallRequest(requestValue);
  const launch = prepareMcpInspectionInvocation(resolved, runtimeDirectory);
  return parseMcpToolCallInvocation({
    connectionId: launch.connectionId,
    command: launch.command,
    args: launch.args,
    environment: launch.environment,
    workingDirectory: launch.workingDirectory,
    toolName: request.toolName,
    inputSchemaSha256: createHash("sha256").update(request.inputSchemaJson, "utf8").digest("hex"),
    taskSupport: request.taskSupport,
    arguments: request.arguments,
    budget: mcpToolCallBudget,
  });
}

function auditErrorCode(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "CANCELLED";
  if (error instanceof RpcRemoteError && /^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code)) return error.code;
  return "MCP_TOOL_CALL_FAILED";
}

export async function executeApprovedMcpToolCall(
  approvalToken: string,
  requestValue: McpToolCallRequest,
  signal: AbortSignal,
  dependencies: McpToolExecutionDependencies,
): Promise<McpToolCallResult> {
  const approved = dependencies.approvals.consume(approvalToken);
  const request = parseMcpToolCallRequest(requestValue);
  const resolved = dependencies.connections.resolve(request.connectionId);
  const invocation = prepareMcpToolCallInvocation(resolved, dependencies.runtimeDirectory, request);
  if (!dependencies.approvals.matches(approved, resolved.profile.name, invocation)) {
    throw new Error("MCP 连接、工具、模式或参数在批准后发生变化，请重新审查精确调用内容");
  }
  if (signal.aborted) throw new Error("MCP tool call was cancelled before launch");

  const auditId = dependencies.newAuditId();
  dependencies.audits.start({
    auditId,
    connectionId: invocation.connectionId,
    connectionName: resolved.profile.name,
    operation: "tool-call",
    toolName: approved.toolName,
    inputSchemaSha256: approved.inputSchemaSha256,
    inputKeys: [...approved.inputKeys],
    inputBytes: approved.inputBytes,
    requestFingerprint: approved.requestFingerprint,
    startedAt: dependencies.now(),
  });
  let result: McpToolCallResult;
  try {
    result = await dependencies.call(invocation, signal);
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

interface McpToolApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly connections: McpConnectionStore;
  readonly approvals: McpToolApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly operations: OperationRegistry;
  readonly runtimeDirectory: string;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

export function registerMcpToolApi({
  sidecars,
  connections,
  approvals,
  audits,
  operations,
  runtimeDirectory,
  assertTrustedSender,
}: McpToolApiDependencies): void {
  ipcMain.handle(desktopChannels.prepareMcpToolCall, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const request = parseMcpToolCallRequest(value);
    validateMcpToolArguments(request.inputSchemaJson, request.arguments);
    const resolved = connections.resolve(request.connectionId);
    const invocation = prepareMcpToolCallInvocation(resolved, runtimeDirectory, request);
    return approvals.issue(resolved.profile.name, request, invocation);
  });
  ipcMain.handle(desktopChannels.approveMcpToolCall, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpToolCallApproval(envelope.value);
    return operations.run(envelope.operationId, (signal) => executeApprovedMcpToolCall(
      approval.approvalToken,
      approval.request,
      signal,
      {
        connections,
        approvals,
        audits,
        runtimeDirectory,
        call: (invocation, callSignal) => sidecars.callMcpTool(invocation, callSignal),
        now: () => new Date().toISOString(),
        newAuditId: randomUUID,
      },
    ));
  });
  ipcMain.handle(desktopChannels.dismissMcpToolCall, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    approvals.revoke(parseMcpToolCallApproval(value).approvalToken);
  });
}
