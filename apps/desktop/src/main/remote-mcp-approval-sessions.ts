import { mcpInspectionBudget, mcpToolCallBudget, parseRemoteMcpInspectionProposal, parseRemoteMcpToolCallProposal, type McpToolCallRequest, type RemoteMcpConnectionProfile, type RemoteMcpInspectionProposal, type RemoteMcpToolCallProposal } from "@bubu/contracts";

const lifetimeMilliseconds = 10 * 60 * 1_000;
interface Pending { readonly profile: RemoteMcpConnectionProfile; readonly expiresAt: number }
interface PendingTool { readonly profile: RemoteMcpConnectionProfile; readonly request: McpToolCallRequest; readonly expiresAt: number }
export interface RemoteMcpInspectionApprovalStore { issue(profile: RemoteMcpConnectionProfile): RemoteMcpInspectionProposal; consume(token: string): RemoteMcpConnectionProfile; issueTool(profile: RemoteMcpConnectionProfile, request: McpToolCallRequest): RemoteMcpToolCallProposal; consumeTool(token: string): { readonly profile: RemoteMcpConnectionProfile; readonly request: McpToolCallRequest }; revoke(token: string): void }

export function createRemoteMcpInspectionApprovalStore(options: { readonly now: () => number; readonly newToken: () => string }): RemoteMcpInspectionApprovalStore {
  const pending = new Map<string, Pending>();
  const pendingTools = new Map<string, PendingTool>();
  return {
    issue(profile) {
      for (const [token, session] of pending) if (session.expiresAt <= options.now()) pending.delete(token);
      while (pending.size >= 20) pending.delete(pending.keys().next().value as string);
      const approvalToken = options.newToken();
      const expiresAt = options.now() + lifetimeMilliseconds;
      const proposal = parseRemoteMcpInspectionProposal({ approvalToken, expiresAt: new Date(expiresAt).toISOString(), connection: profile, budget: mcpInspectionBudget, warning: "remote-untrusted-network-service" });
      pending.set(approvalToken, { profile: proposal.connection, expiresAt });
      return proposal;
    },
    consume(token) { const session = pending.get(token); pending.delete(token); if (!session || session.expiresAt <= options.now()) throw new Error("Remote MCP inspection approval expired or has already been used"); return session.profile; },
    issueTool(profile, request) {
      for (const [token, session] of pendingTools) if (session.expiresAt <= options.now()) pendingTools.delete(token);
      while (pendingTools.size >= 20) pendingTools.delete(pendingTools.keys().next().value as string);
      const approvalToken = options.newToken(); const expiresAt = options.now() + lifetimeMilliseconds;
      const proposal = parseRemoteMcpToolCallProposal({ approvalToken, expiresAt: new Date(expiresAt).toISOString(), connection: profile, request, budget: mcpToolCallBudget, warning: "remote-untrusted-tool-and-side-effects" });
      pendingTools.set(approvalToken, { profile: proposal.connection, request: proposal.request, expiresAt }); return proposal;
    },
    consumeTool(token) { const session = pendingTools.get(token); pendingTools.delete(token); if (!session || session.expiresAt <= options.now()) throw new Error("Remote MCP tool approval expired or has already been used"); return { profile: session.profile, request: session.request }; },
    revoke(token) { pending.delete(token); pendingTools.delete(token); },
  };
}
