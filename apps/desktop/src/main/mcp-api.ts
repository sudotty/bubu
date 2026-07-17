import { realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { ipcMain } from "electron";
import {
  mcpInspectionBudget,
  parseMcpConnectionConfigurationInput,
  parseMcpConnectionId,
  parseMcpInspectionApproval,
  parseMcpInspectionInvocation,
  parseOperationEnvelope,
  type McpInspectionInvocation,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { McpConnectionStore, ResolvedMcpConnection } from "./mcp-connection-store.js";
import type { McpInspectionApprovalSessionStore } from "./mcp-inspection-approval-sessions.js";
import type { OperationRegistry } from "./operation-registry.js";
import { preparePrivateDirectory } from "./secure-files.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface McpApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly connections: McpConnectionStore;
  readonly approvals: McpInspectionApprovalSessionStore;
  readonly operations: OperationRegistry;
  readonly runtimeDirectory: string;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

export function prepareMcpInspectionInvocation(
  resolved: ResolvedMcpConnection,
  runtimeDirectory: string,
): McpInspectionInvocation {
  const command = realpathSync(resolved.profile.transport.command);
  const metadata = statSync(command);
  if (!metadata.isFile()) throw new Error("MCP launch target is not a regular file");
  if (process.platform !== "win32" && (metadata.mode & 0o111) === 0) {
    throw new Error("MCP launch target is not executable");
  }
  preparePrivateDirectory(runtimeDirectory);
  const workingDirectory = join(runtimeDirectory, resolved.profile.id);
  preparePrivateDirectory(workingDirectory);
  return parseMcpInspectionInvocation({
    connectionId: resolved.profile.id,
    command,
    args: resolved.profile.transport.args,
    environment: resolved.environment,
    workingDirectory,
    budget: mcpInspectionBudget,
  });
}

export function registerMcpApi({
  sidecars,
  connections,
  approvals,
  operations,
  runtimeDirectory,
  assertTrustedSender,
}: McpApiDependencies): void {
  ipcMain.handle(desktopChannels.listMcpConnections, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return connections.state();
  });
  ipcMain.handle(desktopChannels.saveMcpConnection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return connections.save(parseMcpConnectionConfigurationInput(value));
  });
  ipcMain.handle(desktopChannels.removeMcpConnection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return connections.remove(parseMcpConnectionId(value));
  });
  ipcMain.handle(desktopChannels.prepareMcpInspection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const resolved = connections.resolve(parseMcpConnectionId(value));
    return approvals.issue(
      resolved.profile.name,
      prepareMcpInspectionInvocation(resolved, runtimeDirectory),
    );
  });
  ipcMain.handle(desktopChannels.approveMcpInspection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpInspectionApproval(envelope.value);
    return operations.run(envelope.operationId, (signal) => {
      const approved = approvals.consume(approval.approvalToken);
      const resolved = connections.resolve(approved.connectionId);
      const current = {
        name: resolved.profile.name,
        invocation: prepareMcpInspectionInvocation(resolved, runtimeDirectory),
      };
      if (!approvals.matches(approved, current.name, current.invocation)) {
        throw new Error("MCP 连接在批准后发生变化，请重新审查精确启动内容");
      }
      return sidecars.inspectMcp(current.invocation, signal);
    });
  });
  ipcMain.handle(desktopChannels.dismissMcpInspection, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    approvals.revoke(parseMcpInspectionApproval(value).approvalToken);
  });
}
