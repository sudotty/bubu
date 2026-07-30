import {
  parseMcpModelToolProposal,
  parseMcpPromptModelProposal,
  type McpModelToolPreparation,
  type McpModelToolProposal,
  type McpPromptModelPreparation,
  type McpPromptModelProposal,
} from "@bubu/contracts";
import { createOneUseAuthorizationStore } from "./one-use-authorization-store.js";

const lifetimeMilliseconds = 10 * 60 * 1_000;
const maximumSessions = 20;
type Destination = McpPromptModelProposal["destination"];
type Pending = { readonly kind: "prompt"; readonly proposal: McpPromptModelProposal } | { readonly kind: "tool"; readonly proposal: McpModelToolProposal };

export interface McpModelApprovalSessionStore {
  issuePrompt(preparation: McpPromptModelPreparation, destination: Destination, payloadBytes: number, payloadSha256: string): McpPromptModelProposal;
  issueTool(preparation: McpModelToolPreparation, destination: Destination, payloadBytes: number, payloadSha256: string): McpModelToolProposal;
  consumePrompt(token: string): McpPromptModelProposal;
  consumeTool(token: string): McpModelToolProposal;
  revoke(token: string): void;
}

export function createMcpModelApprovalSessionStore(options: { readonly now: () => number; readonly newToken: () => string }): McpModelApprovalSessionStore {
  const authorizations = createOneUseAuthorizationStore<Pending>({ ...options, lifetimeMilliseconds, maximumSessions, allocationError: "Could not allocate a unique MCP model approval", consumeError: "MCP model approval expired or has already been used" });
  const consume = (token: string, kind: Pending["kind"]): Pending => {
    const session = authorizations.consume(token);
    if (session.kind !== kind) throw new Error("MCP model approval does not authorize this operation");
    return session;
  };
  return {
    issuePrompt(preparation, destination, payloadBytes, payloadSha256) {
      let proposal: McpPromptModelProposal | undefined;
      authorizations.issueWithGrant(({ token, expiresAt }) => {
        proposal = parseMcpPromptModelProposal({ approvalToken: token, expiresAt: new Date(expiresAt).toISOString(), destination, preparation, payloadBytes, payloadSha256, warning: "untrusted-mcp-prompt-to-model" });
        return { kind: "prompt", proposal };
      });
      if (!proposal) throw new Error("Could not allocate a unique MCP model approval");
      return proposal;
    },
    issueTool(preparation, destination, payloadBytes, payloadSha256) {
      let proposal: McpModelToolProposal | undefined;
      authorizations.issueWithGrant(({ token, expiresAt }) => {
        proposal = parseMcpModelToolProposal({ approvalToken: token, expiresAt: new Date(expiresAt).toISOString(), destination, preparation, payloadBytes, payloadSha256, warning: "untrusted-tool-metadata-to-model" });
        return { kind: "tool", proposal };
      });
      if (!proposal) throw new Error("Could not allocate a unique MCP model approval");
      return proposal;
    },
    consumePrompt(token) { return (consume(token, "prompt") as Extract<Pending, { kind: "prompt" }>).proposal; },
    consumeTool(token) { return (consume(token, "tool") as Extract<Pending, { kind: "tool" }>).proposal; },
    revoke(token) { authorizations.revoke(token); },
  };
}
