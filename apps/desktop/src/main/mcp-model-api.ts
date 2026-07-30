import { createHash, randomUUID } from "node:crypto";
import { ipcMain } from "electron";
import {
  canonicalMcpJson,
  parseMcpModelToolApproval,
  parseMcpModelToolExecutionProposal,
  parseMcpModelToolPreparation,
  parseMcpPromptModelApproval,
  parseMcpPromptModelPreparation,
  parseMcpToolCallApproval,
  parseMcpToolCallRequest,
  parseOperationEnvelope,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import { generateAuditedModel } from "./model-audit.js";
import type { McpAuditStore } from "./mcp-audit-store.js";
import type { McpConnectionStore } from "./mcp-connection-store.js";
import type { McpModelApprovalSessionStore } from "./mcp-model-approval-sessions.js";
import { buildMcpPromptModelInvocation, buildMcpToolProposalInvocation, createMcpModelToolSuggestion, createMcpPromptModelAnswer, mcpModelPayload } from "./mcp-model-orchestrator.js";
import { executeApprovedMcpToolCall, prepareMcpToolCallInvocation } from "./mcp-tool-api.js";
import type { McpToolApprovalSessionStore } from "./mcp-tool-approval-sessions.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { PrivacyPolicyStore } from "./privacy-policy-store.js";
import type { ProviderStore, ResolvedProvider } from "./provider-store.js";
import type { LocalMcpToolPort } from "./sidecar-ports.js";

interface Dependencies {
  readonly sidecars: LocalMcpToolPort;
  readonly providers: ProviderStore;
  readonly connections: McpConnectionStore;
  readonly approvals: McpModelApprovalSessionStore;
  readonly toolApprovals: McpToolApprovalSessionStore;
  readonly audits: McpAuditStore;
  readonly operations: OperationRegistry;
  readonly privacyPolicy: PrivacyPolicyStore;
  readonly runtimeDirectory: string;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

const destinationFor = (resolved: ResolvedProvider) => ({ providerId: resolved.profile.id, providerKind: resolved.profile.kind, providerName: resolved.profile.name, model: resolved.profile.model, endpointOrigin: new URL(resolved.profile.baseUrl).origin });
const same = (left: unknown, right: unknown) => canonicalMcpJson(left) === canonicalMcpJson(right);

function activeProvider(providers: ProviderStore): ResolvedProvider {
  const id = providers.state().activeProviderId;
  if (id === null) throw new Error("请先在模型设置中配置并选择一个模型");
  return providers.resolve(id);
}

export function registerMcpModelApi({ sidecars, providers, connections, approvals, toolApprovals, audits, operations, privacyPolicy, runtimeDirectory, assertTrustedSender }: Dependencies): void {
  ipcMain.handle(desktopChannels.prepareMcpPromptModel, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const preparation = parseMcpPromptModelPreparation(value);
    connections.resolve(preparation.prompt.connectionId);
    const resolved = activeProvider(providers);
    privacyPolicy.assertMcpModelContentAllowed(resolved.profile.baseUrl, preparation.purpose, canonicalMcpJson(preparation.prompt));
    const payload = mcpModelPayload(preparation);
    return approvals.issuePrompt(preparation, destinationFor(resolved), payload.bytes, payload.sha256);
  });
  ipcMain.handle(desktopChannels.approveMcpPromptModel, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpPromptModelApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const proposal = approvals.consumePrompt(approval.approvalToken);
      connections.resolve(proposal.preparation.prompt.connectionId);
      const resolved = providers.resolve(proposal.destination.providerId);
      if (!same(destinationFor(resolved), proposal.destination)) throw new Error("模型目标在批准后发生变化，请重新审查 MCP 提示披露");
      privacyPolicy.assertMcpModelContentAllowed(resolved.profile.baseUrl, proposal.preparation.purpose, canonicalMcpJson(proposal.preparation.prompt));
      const payload = mcpModelPayload(proposal.preparation);
      if (payload.bytes !== proposal.payloadBytes || payload.sha256 !== proposal.payloadSha256) throw new Error("MCP 提示内容在批准后发生变化，请重新审查");
      const completion = await generateAuditedModel(sidecars, buildMcpPromptModelInvocation(resolved, proposal), {
        purpose: "mcp-prompt-response", target: { kind: "mcp-connection", id: proposal.preparation.prompt.connectionId }, contexts: [], disclosure: "mcp-prompt-content", datasetCount: 0, columnCount: 0, relationshipCount: 0,
      }, signal);
      return createMcpPromptModelAnswer(proposal, completion);
    });
  });
  ipcMain.handle(desktopChannels.prepareMcpModelTool, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const preparation = parseMcpModelToolPreparation(value);
    const connection = connections.resolve(preparation.connectionId);
    if (connection.profile.name !== preparation.connectionName) throw new Error("MCP 连接名称已变化，请重新检查工具目录");
    const resolved = activeProvider(providers);
    privacyPolicy.assertMcpModelContentAllowed(resolved.profile.baseUrl, preparation.goal, canonicalMcpJson(preparation.tools));
    const payload = mcpModelPayload(preparation);
    return approvals.issueTool(preparation, destinationFor(resolved), payload.bytes, payload.sha256);
  });
  ipcMain.handle(desktopChannels.approveMcpModelTool, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpModelToolApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const proposal = approvals.consumeTool(approval.approvalToken);
      const connection = connections.resolve(proposal.preparation.connectionId);
      if (connection.profile.name !== proposal.preparation.connectionName) throw new Error("MCP 连接在批准后发生变化，请重新检查工具目录");
      const resolved = providers.resolve(proposal.destination.providerId);
      if (!same(destinationFor(resolved), proposal.destination)) throw new Error("模型目标在批准后发生变化，请重新审查 MCP 工具目录披露");
      privacyPolicy.assertMcpModelContentAllowed(resolved.profile.baseUrl, proposal.preparation.goal, canonicalMcpJson(proposal.preparation.tools));
      const payload = mcpModelPayload(proposal.preparation);
      if (payload.bytes !== proposal.payloadBytes || payload.sha256 !== proposal.payloadSha256) throw new Error("MCP 工具目录在批准后发生变化，请重新审查");
      const completion = await generateAuditedModel(sidecars, buildMcpToolProposalInvocation(resolved, proposal), {
        purpose: "mcp-tool-proposal", target: { kind: "mcp-connection", id: proposal.preparation.connectionId }, contexts: [], disclosure: "mcp-tool-schemas", datasetCount: 0, columnCount: 0, relationshipCount: 0,
      }, signal);
      const suggestion = createMcpModelToolSuggestion(proposal, completion);
      const tool = proposal.preparation.tools.find(({ name }) => name === suggestion.toolName)!;
      const request = parseMcpToolCallRequest({ connectionId: proposal.preparation.connectionId, toolName: tool.name, inputSchemaJson: tool.inputSchemaJson, taskSupport: tool.taskSupport, arguments: suggestion.arguments });
      const invocation = prepareMcpToolCallInvocation(connection, runtimeDirectory, request);
      const execution = toolApprovals.issue(connection.profile.name, request, invocation);
      return parseMcpModelToolExecutionProposal({ ...execution, proposedByModel: true, modelDestination: proposal.destination, goalSha256: createHash("sha256").update(proposal.preparation.goal).digest("hex") });
    });
  });
  ipcMain.handle(desktopChannels.executeMcpModelTool, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseMcpToolCallApproval(envelope.value);
    return operations.run(envelope.operationId, (signal) => executeApprovedMcpToolCall(approval.approvalToken, approval.request, signal, {
      connections, approvals: toolApprovals, audits, runtimeDirectory,
      call: (invocation, callSignal) => sidecars.callMcpTool(invocation, callSignal), now: () => new Date().toISOString(), newAuditId: randomUUID,
    }));
  });
  ipcMain.handle(desktopChannels.dismissMcpModel, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const token = parseMcpPromptModelApproval(value).approvalToken;
    approvals.revoke(token);
    toolApprovals.revoke(token);
  });
}
