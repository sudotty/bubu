import { createHash, timingSafeEqual } from "node:crypto";
import {
  mcpPromptGetBudget,
  parseMcpPromptGetInvocation,
  parseMcpPromptGetProposal,
  type McpPromptGetInvocation,
  type McpPromptGetProposal,
} from "@bubu/contracts";

const mcpPromptApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumMcpPromptApprovalSessions = 20;

export interface ApprovedMcpPromptGet {
  readonly name: string;
  readonly connectionId: McpPromptGetInvocation["connectionId"];
  readonly promptName: string;
  readonly argumentKeys: readonly string[];
  readonly argumentBytes: number;
  readonly requestFingerprint: string;
  readonly launchFingerprint: string;
}

interface PendingMcpPromptGet extends ApprovedMcpPromptGet {
  readonly expiresAt: number;
}

interface McpPromptApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

export interface McpPromptApprovalSessionStore {
  issue(name: string, invocation: McpPromptGetInvocation): McpPromptGetProposal;
  consume(token: string): ApprovedMcpPromptGet;
  matches(approved: ApprovedMcpPromptGet, name: string, invocation: McpPromptGetInvocation): boolean;
  revoke(token: string): void;
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function argumentPayload(invocation: McpPromptGetInvocation): Readonly<Record<string, string>> {
  return Object.fromEntries(invocation.arguments.map(({ name, value }) => [name, value]));
}

function argumentBytes(invocation: McpPromptGetInvocation): number {
  return new TextEncoder().encode(JSON.stringify(argumentPayload(invocation))).byteLength;
}

function launchFingerprint(name: string, invocation: McpPromptGetInvocation): string {
  return hash({ name, invocation });
}

function requestFingerprint(name: string, invocation: McpPromptGetInvocation): string {
  return hash({
    name,
    connectionId: invocation.connectionId,
    command: invocation.command,
    args: invocation.args,
    environmentKeys: Object.keys(invocation.environment),
    workingDirectory: invocation.workingDirectory,
    promptName: invocation.promptName,
    argumentKeys: invocation.arguments.map(({ name: argumentName }) => argumentName),
    argumentBytes: argumentBytes(invocation),
    budget: invocation.budget,
  });
}

export function createMcpPromptApprovalSessionStore(
  options: McpPromptApprovalSessionOptions,
): McpPromptApprovalSessionStore {
  const pending = new Map<string, PendingMcpPromptGet>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt <= now) pending.delete(token);
    }
  }

  return {
    issue(name, value) {
      removeExpired();
      while (pending.size >= maximumMcpPromptApprovalSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const invocation = parseMcpPromptGetInvocation(value);
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique MCP prompt approval");
      const expiresAt = options.now() + mcpPromptApprovalLifetimeMilliseconds;
      const proposal = parseMcpPromptGetProposal({
        approvalToken,
        expiresAt: new Date(expiresAt).toISOString(),
        connection: {
          id: invocation.connectionId,
          name,
          command: invocation.command,
          args: invocation.args,
          environmentKeys: Object.keys(invocation.environment),
        },
        promptName: invocation.promptName,
        arguments: invocation.arguments,
        budget: mcpPromptGetBudget,
        warning: "untrusted-local-code-argument-disclosure-and-content",
      });
      const argumentKeys = invocation.arguments.map(({ name: argumentName }) => argumentName);
      pending.set(approvalToken, {
        name: proposal.connection.name,
        connectionId: invocation.connectionId,
        promptName: invocation.promptName,
        argumentKeys,
        argumentBytes: argumentBytes(invocation),
        requestFingerprint: requestFingerprint(proposal.connection.name, invocation),
        launchFingerprint: launchFingerprint(proposal.connection.name, invocation),
        expiresAt,
      });
      return proposal;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt <= options.now()) {
        throw new Error("MCP prompt approval expired or has already been used");
      }
      return {
        name: session.name,
        connectionId: session.connectionId,
        promptName: session.promptName,
        argumentKeys: session.argumentKeys,
        argumentBytes: session.argumentBytes,
        requestFingerprint: session.requestFingerprint,
        launchFingerprint: session.launchFingerprint,
      };
    },
    matches(approved, name, value) {
      const invocation = parseMcpPromptGetInvocation(value);
      if (approved.connectionId !== invocation.connectionId || approved.promptName !== invocation.promptName) {
        return false;
      }
      return timingSafeEqual(
        Buffer.from(approved.launchFingerprint, "hex"),
        Buffer.from(launchFingerprint(name, invocation), "hex"),
      );
    },
    revoke(token) {
      pending.delete(token);
    },
  };
}
