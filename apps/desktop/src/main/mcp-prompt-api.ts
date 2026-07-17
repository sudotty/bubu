import { randomUUID } from "node:crypto";
import { ipcMain } from "electron";
import {
  mcpPromptGetBudget,
  parseMcpPromptGetApproval,
  parseMcpPromptGetInvocation,
  parseMcpPromptGetRequest,
  parseOperationEnvelope,
  type McpPromptGetInvocation,
  type McpPromptGetRequest,
  type McpPromptGetResult,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { McpAuditStore } from "./mcp-audit-store.js";
import type { McpConnectionStore, ResolvedMcpConnection } from "./mcp-connection-store.js";
import type { McpPromptApprovalSessionStore } from "./mcp-prompt-approval-sessions.js";
import { prepareMcpInspectionInvocation } from "./mcp-api.js";
import type { OperationRegistry } from "./operation-registry.js";
import { RpcRemoteError } from "./rpc-broker.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface McpPromptExecutionDependencies {
  readonly connections: Pick<McpConnectionStore, "resolve">;
  readonly approvals: McpPromptApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly runtimeDirectory: string;
  readonly get: (invocation: McpPromptGetInvocation, signal: AbortSignal) => Promise<McpPromptGetResult>;
  readonly now: () => string;
  readonly newAuditId: () => string;
}

export function prepareMcpPromptGetInvocation(
  resolved: ResolvedMcpConnection,
  runtimeDirectory: string,
  promptName: string,
  argumentValues: McpPromptGetInvocation["arguments"],
): McpPromptGetInvocation {
  const launch = prepareMcpInspectionInvocation(resolved, runtimeDirectory);
  return parseMcpPromptGetInvocation({
    connectionId: launch.connectionId,
    command: launch.command,
    args: launch.args,
    environment: launch.environment,
    workingDirectory: launch.workingDirectory,
    promptName,
    arguments: argumentValues,
    budget: mcpPromptGetBudget,
  });
}

function auditErrorCode(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "CANCELLED";
  if (error instanceof RpcRemoteError && /^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code)) return error.code;
  return "MCP_PROMPT_GET_FAILED";
}

export async function executeApprovedMcpPromptGet(
  approvalToken: string,
  requestValue: McpPromptGetRequest,
  signal: AbortSignal,
  dependencies: McpPromptExecutionDependencies,
): Promise<McpPromptGetResult> {
  const approved = dependencies.approvals.consume(approvalToken);
  const request = parseMcpPromptGetRequest(requestValue);
  if (request.connectionId !== approved.connectionId || request.promptName !== approved.promptName) {
    throw new Error("MCP 连接、提示或参数在批准后发生变化，请重新审查精确获取内容");
  }
  const resolved = dependencies.connections.resolve(request.connectionId);
  const invocation = prepareMcpPromptGetInvocation(
    resolved,
    dependencies.runtimeDirectory,
    request.promptName,
    request.arguments,
  );
  if (!dependencies.approvals.matches(approved, resolved.profile.name, invocation)) {
    throw new Error("MCP 连接、提示或参数在批准后发生变化，请重新审查精确获取内容");
  }
  if (signal.aborted) throw new Error("MCP prompt get was cancelled before launch");

  const auditId = dependencies.newAuditId();
  dependencies.audits.start({
    auditId,
    connectionId: invocation.connectionId,
    connectionName: resolved.profile.name,
    operation: "prompt-get",
    promptName: approved.promptName,
    argumentKeys: [...approved.argumentKeys],
    argumentBytes: approved.argumentBytes,
    requestFingerprint: approved.requestFingerprint,
    startedAt: dependencies.now(),
  });
  let result: McpPromptGetResult;
  try {
    result = await dependencies.get(invocation, signal);
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
    contentParts: result.messages.length,
    decodedBytes: result.decodedBytes,
  });
  return result;
}

interface McpPromptApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly connections: McpConnectionStore;
  readonly approvals: McpPromptApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly operations: OperationRegistry;
  readonly runtimeDirectory: string;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

export function registerMcpPromptApi({
  sidecars,
  connections,
  approvals,
  audits,
  operations,
  runtimeDirectory,
  assertTrustedSender,
}: McpPromptApiDependencies): void {
  ipcMain.handle(desktopChannels.prepareMcpPromptGet, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const request = parseMcpPromptGetRequest(value);
    const resolved = connections.resolve(request.connectionId);
    return approvals.issue(
      resolved.profile.name,
      prepareMcpPromptGetInvocation(resolved, runtimeDirectory, request.promptName, request.arguments),
    );
  });
  ipcMain.handle(desktopChannels.approveMcpPromptGet, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpPromptGetApproval(envelope.value);
    return operations.run(envelope.operationId, (signal) => executeApprovedMcpPromptGet(
      approval.approvalToken,
      approval.request,
      signal,
      {
        connections,
        approvals,
        audits,
        runtimeDirectory,
        get: (invocation, getSignal) => sidecars.getMcpPrompt(invocation, getSignal),
        now: () => new Date().toISOString(),
        newAuditId: randomUUID,
      },
    ));
  });
  ipcMain.handle(desktopChannels.dismissMcpPromptGet, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    approvals.revoke(parseMcpPromptGetApproval(value).approvalToken);
  });
}
