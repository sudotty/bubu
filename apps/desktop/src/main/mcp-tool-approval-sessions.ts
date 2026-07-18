import { createHash, timingSafeEqual } from "node:crypto";
import {
  canonicalMcpJson,
  mcpToolCallBudget,
  parseMcpToolCallInvocation,
  parseMcpToolCallProposal,
  parseMcpToolCallRequest,
  type McpToolCallInvocation,
  type McpToolCallProposal,
  type McpToolCallRequest,
} from "@bubu/contracts";

const mcpToolApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumMcpToolApprovalSessions = 20;

export interface ApprovedMcpToolCall {
  readonly name: string;
  readonly connectionId: McpToolCallInvocation["connectionId"];
  readonly toolName: string;
  readonly inputSchemaSha256: string;
  readonly taskSupport: McpToolCallInvocation["taskSupport"];
  readonly inputKeys: readonly string[];
  readonly inputBytes: number;
  readonly requestFingerprint: string;
  readonly launchFingerprint: string;
}

interface PendingMcpToolCall extends ApprovedMcpToolCall {
  readonly expiresAt: number;
}

interface McpToolApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

export interface McpToolApprovalSessionStore {
  issue(name: string, request: McpToolCallRequest, invocation: McpToolCallInvocation): McpToolCallProposal;
  consume(token: string): ApprovedMcpToolCall;
  matches(approved: ApprovedMcpToolCall, name: string, invocation: McpToolCallInvocation): boolean;
  revoke(token: string): void;
}

function hash(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalMcpJson(value), "utf8").digest("hex");
}

function inputKeys(invocation: McpToolCallInvocation): readonly string[] {
  return Object.keys(invocation.arguments).sort();
}

function inputBytes(invocation: McpToolCallInvocation): number {
  return new TextEncoder().encode(canonicalMcpJson(invocation.arguments)).byteLength;
}

function launchFingerprint(name: string, invocation: McpToolCallInvocation): string {
  return hash({ name, invocation });
}

function requestFingerprint(name: string, invocation: McpToolCallInvocation): string {
  return hash({
    name,
    connectionId: invocation.connectionId,
    command: invocation.command,
    args: invocation.args,
    environmentKeys: Object.keys(invocation.environment).sort(),
    workingDirectory: invocation.workingDirectory,
    toolName: invocation.toolName,
    inputSchemaSha256: invocation.inputSchemaSha256,
    taskSupport: invocation.taskSupport,
    inputKeys: inputKeys(invocation),
    inputBytes: inputBytes(invocation),
    budget: invocation.budget,
  });
}

function assertRequestMatchesInvocation(
  request: McpToolCallRequest,
  invocation: McpToolCallInvocation,
): void {
  const requestSchemaSha256 = hash(request.inputSchemaJson);
  if (
    request.connectionId !== invocation.connectionId ||
    request.toolName !== invocation.toolName ||
    request.taskSupport !== invocation.taskSupport ||
    requestSchemaSha256 !== invocation.inputSchemaSha256 ||
    canonicalMcpJson(request.arguments) !== canonicalMcpJson(invocation.arguments)
  ) {
    throw new Error("MCP tool schema or exact request differs from its invocation");
  }
  if (request.taskSupport === "required") {
    throw new Error("MCP task-required tools are not supported by this bounded call path");
  }
}

export function createMcpToolApprovalSessionStore(
  options: McpToolApprovalSessionOptions,
): McpToolApprovalSessionStore {
  const pending = new Map<string, PendingMcpToolCall>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt <= now) pending.delete(token);
    }
  }

  return {
    issue(name, requestValue, invocationValue) {
      removeExpired();
      while (pending.size >= maximumMcpToolApprovalSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const request = parseMcpToolCallRequest(requestValue);
      const invocation = parseMcpToolCallInvocation(invocationValue);
      assertRequestMatchesInvocation(request, invocation);
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique MCP tool approval");
      const expiresAt = options.now() + mcpToolApprovalLifetimeMilliseconds;
      const proposal = parseMcpToolCallProposal({
        approvalToken,
        expiresAt: new Date(expiresAt).toISOString(),
        connection: {
          id: invocation.connectionId,
          name,
          command: invocation.command,
          args: invocation.args,
          environmentKeys: Object.keys(invocation.environment),
        },
        toolName: invocation.toolName,
        inputSchemaJson: request.inputSchemaJson,
        inputSchemaSha256: invocation.inputSchemaSha256,
        taskSupport: invocation.taskSupport,
        arguments: invocation.arguments,
        budget: mcpToolCallBudget,
        warning: "untrusted-local-code-arguments-content-and-side-effects",
      });
      pending.set(approvalToken, {
        name: proposal.connection.name,
        connectionId: invocation.connectionId,
        toolName: invocation.toolName,
        inputSchemaSha256: invocation.inputSchemaSha256,
        taskSupport: invocation.taskSupport,
        inputKeys: inputKeys(invocation),
        inputBytes: inputBytes(invocation),
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
        throw new Error("MCP tool approval expired or has already been used");
      }
      return {
        name: session.name,
        connectionId: session.connectionId,
        toolName: session.toolName,
        inputSchemaSha256: session.inputSchemaSha256,
        taskSupport: session.taskSupport,
        inputKeys: session.inputKeys,
        inputBytes: session.inputBytes,
        requestFingerprint: session.requestFingerprint,
        launchFingerprint: session.launchFingerprint,
      };
    },
    matches(approved, name, value) {
      const invocation = parseMcpToolCallInvocation(value);
      if (
        approved.connectionId !== invocation.connectionId ||
        approved.toolName !== invocation.toolName ||
        approved.inputSchemaSha256 !== invocation.inputSchemaSha256 ||
        approved.taskSupport !== invocation.taskSupport
      ) return false;
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
