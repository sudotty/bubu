import { createHash, timingSafeEqual } from "node:crypto";
import {
  mcpInspectionBudget,
  parseMcpInspectionInvocation,
  parseMcpInspectionProposal,
  type McpInspectionInvocation,
  type McpInspectionProposal,
} from "@bubu/contracts";

const mcpInspectionApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumMcpInspectionApprovalSessions = 20;

export interface ApprovedMcpInspection {
  readonly name: string;
  readonly connectionId: McpInspectionInvocation["connectionId"];
  readonly invocationFingerprint: string;
}

interface PendingMcpInspection extends ApprovedMcpInspection {
  readonly expiresAt: number;
}

interface McpInspectionApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

export interface McpInspectionApprovalSessionStore {
  issue(name: string, invocation: McpInspectionInvocation): McpInspectionProposal;
  consume(token: string): ApprovedMcpInspection;
  matches(approved: ApprovedMcpInspection, name: string, invocation: McpInspectionInvocation): boolean;
  revoke(token: string): void;
}

function fingerprint(name: string, invocation: McpInspectionInvocation): string {
  return createHash("sha256").update(JSON.stringify({ name, invocation }), "utf8").digest("hex");
}

export function createMcpInspectionApprovalSessionStore(
  options: McpInspectionApprovalSessionOptions,
): McpInspectionApprovalSessionStore {
  const pending = new Map<string, PendingMcpInspection>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt <= now) pending.delete(token);
    }
  }

  return {
    issue(name, value) {
      removeExpired();
      while (pending.size >= maximumMcpInspectionApprovalSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const invocation = parseMcpInspectionInvocation(value);
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique MCP inspection approval");
      const expiresAt = options.now() + mcpInspectionApprovalLifetimeMilliseconds;
      const proposal = parseMcpInspectionProposal({
        approvalToken,
        expiresAt: new Date(expiresAt).toISOString(),
        connection: {
          id: invocation.connectionId,
          name,
          command: invocation.command,
          args: invocation.args,
          environmentKeys: Object.keys(invocation.environment),
        },
        budget: mcpInspectionBudget,
        warning: "untrusted-local-code",
      });
      pending.set(approvalToken, {
        name: proposal.connection.name,
        connectionId: invocation.connectionId,
        invocationFingerprint: fingerprint(proposal.connection.name, invocation),
        expiresAt,
      });
      return proposal;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt <= options.now()) {
        throw new Error("MCP inspection approval expired or has already been used");
      }
      return {
        name: session.name,
        connectionId: session.connectionId,
        invocationFingerprint: session.invocationFingerprint,
      };
    },
    matches(approved, name, value) {
      const invocation = parseMcpInspectionInvocation(value);
      if (approved.connectionId !== invocation.connectionId) return false;
      return timingSafeEqual(
        Buffer.from(approved.invocationFingerprint, "hex"),
        Buffer.from(fingerprint(name, invocation), "hex"),
      );
    },
    revoke(token) {
      pending.delete(token);
    },
  };
}
