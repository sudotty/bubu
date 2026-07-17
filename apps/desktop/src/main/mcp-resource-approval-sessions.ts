import { createHash, timingSafeEqual } from "node:crypto";
import {
  mcpResourceReadBudget,
  parseMcpResourceReadInvocation,
  parseMcpResourceReadProposal,
  type McpResourceReadInvocation,
  type McpResourceReadProposal,
} from "@bubu/contracts";

const mcpResourceApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumMcpResourceApprovalSessions = 20;

export interface ApprovedMcpResourceRead {
  readonly name: string;
  readonly connectionId: McpResourceReadInvocation["connectionId"];
  readonly resourceUri: string;
  readonly requestFingerprint: string;
  readonly launchFingerprint: string;
}

interface PendingMcpResourceRead extends ApprovedMcpResourceRead {
  readonly expiresAt: number;
}

interface McpResourceApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

export interface McpResourceApprovalSessionStore {
  issue(name: string, invocation: McpResourceReadInvocation): McpResourceReadProposal;
  consume(token: string): ApprovedMcpResourceRead;
  matches(approved: ApprovedMcpResourceRead, name: string, invocation: McpResourceReadInvocation): boolean;
  revoke(token: string): void;
}

function fingerprint(name: string, invocation: McpResourceReadInvocation): string {
  return createHash("sha256").update(JSON.stringify({ name, invocation }), "utf8").digest("hex");
}

function requestFingerprint(name: string, invocation: McpResourceReadInvocation): string {
  return createHash("sha256").update(JSON.stringify({
    name,
    connectionId: invocation.connectionId,
    command: invocation.command,
    args: invocation.args,
    environmentKeys: Object.keys(invocation.environment),
    workingDirectory: invocation.workingDirectory,
    resourceUri: invocation.resourceUri,
    budget: invocation.budget,
  }), "utf8").digest("hex");
}

export function createMcpResourceApprovalSessionStore(
  options: McpResourceApprovalSessionOptions,
): McpResourceApprovalSessionStore {
  const pending = new Map<string, PendingMcpResourceRead>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt <= now) pending.delete(token);
    }
  }

  return {
    issue(name, value) {
      removeExpired();
      while (pending.size >= maximumMcpResourceApprovalSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const invocation = parseMcpResourceReadInvocation(value);
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique MCP resource approval");
      const expiresAt = options.now() + mcpResourceApprovalLifetimeMilliseconds;
      const proposal = parseMcpResourceReadProposal({
        approvalToken,
        expiresAt: new Date(expiresAt).toISOString(),
        connection: {
          id: invocation.connectionId,
          name,
          command: invocation.command,
          args: invocation.args,
          environmentKeys: Object.keys(invocation.environment),
        },
        resourceUri: invocation.resourceUri,
        budget: mcpResourceReadBudget,
        warning: "untrusted-local-code-and-content",
      });
      pending.set(approvalToken, {
        name: proposal.connection.name,
        connectionId: invocation.connectionId,
        resourceUri: invocation.resourceUri,
        requestFingerprint: requestFingerprint(proposal.connection.name, invocation),
        launchFingerprint: fingerprint(proposal.connection.name, invocation),
        expiresAt,
      });
      return proposal;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt <= options.now()) {
        throw new Error("MCP resource approval expired or has already been used");
      }
      return {
        name: session.name,
        connectionId: session.connectionId,
        resourceUri: session.resourceUri,
        requestFingerprint: session.requestFingerprint,
        launchFingerprint: session.launchFingerprint,
      };
    },
    matches(approved, name, value) {
      const invocation = parseMcpResourceReadInvocation(value);
      if (approved.connectionId !== invocation.connectionId || approved.resourceUri !== invocation.resourceUri) {
        return false;
      }
      return timingSafeEqual(
        Buffer.from(approved.launchFingerprint, "hex"),
        Buffer.from(fingerprint(name, invocation), "hex"),
      );
    },
    revoke(token) {
      pending.delete(token);
    },
  };
}
