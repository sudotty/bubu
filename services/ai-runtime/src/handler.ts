import {
  createRpcError,
  createRpcSuccess,
  parseMcpInspectionInvocation,
  parseMcpInspectionSnapshot,
  parseMcpResourceReadInvocation,
  parseMcpResourceReadResult,
  parseModelInvocation,
  parseRpcRequest,
  type McpInspectionInvocation,
  type McpInspectionSnapshot,
  type McpResourceReadInvocation,
  type McpResourceReadResult,
  type RpcResponse,
} from "@bubu/contracts";
import {
  invokeProvider,
  ProviderInvocationError,
  type ProviderFetch,
} from "./providers/invoke.js";
import { inspectMcpStdioServer, readMcpStdioResource } from "./mcp/client.js";

export type McpInspector = (
  invocation: McpInspectionInvocation,
  signal?: AbortSignal,
) => Promise<McpInspectionSnapshot>;

export type McpResourceReader = (
  invocation: McpResourceReadInvocation,
  signal?: AbortSignal,
) => Promise<McpResourceReadResult>;

const capabilities = [
  "openai-responses",
  "anthropic-messages",
  "gemini-interactions",
  "openai-compatible",
  "ollama",
  "bounded-http",
  "cancellable-requests",
  "mcp-stdio-inspection",
  "mcp-resource-read",
] as const;

export async function handleAiRuntimeRequest(
  value: unknown,
  expectedAuth: string,
  fetchProvider?: ProviderFetch,
  signal?: AbortSignal,
  inspectMcp: McpInspector = inspectMcpStdioServer,
  readMcpResource: McpResourceReader = readMcpStdioResource,
): Promise<RpcResponse> {
  let request;
  try {
    request = parseRpcRequest(value);
  } catch {
    return createRpcError("invalid-request", "INVALID_REQUEST", "Invalid RPC request", false);
  }

  if (request.auth !== expectedAuth) {
    return createRpcError(request.id, "UNAUTHORIZED", "Invalid process credential", false);
  }

  if (request.method === "system.health") {
    return createRpcSuccess(request.id, {
      service: "ai-runtime",
      protocolVersion: 1,
      status: "ready",
      capabilities,
    });
  }

  if (request.method === "model.generate") {
    let invocation;
    try {
      invocation = parseModelInvocation(request.params);
    } catch {
      return createRpcError(request.id, "INVALID_ARGUMENT", "Invalid model invocation", false);
    }
    try {
      return createRpcSuccess(
        request.id,
        await invokeProvider(invocation, fetchProvider, signal),
      );
    } catch (error) {
      if (signal?.aborted) {
        return createRpcError(request.id, "CANCELLED", "Operation cancelled", false);
      }
      if (error instanceof ProviderInvocationError) {
        return createRpcError(request.id, "PROVIDER_FAILED", error.message, error.retryable);
      }
      return createRpcError(request.id, "PROVIDER_FAILED", "Provider returned an invalid response", false);
    }
  }

  if (request.method === "mcp.inspect") {
    let invocation;
    try {
      invocation = parseMcpInspectionInvocation(request.params);
    } catch {
      return createRpcError(request.id, "INVALID_ARGUMENT", "Invalid MCP inspection invocation", false);
    }
    try {
      return createRpcSuccess(
        request.id,
        parseMcpInspectionSnapshot(await inspectMcp(invocation, signal)),
      );
    } catch (error) {
      if (signal?.aborted) {
        return createRpcError(request.id, "CANCELLED", "Operation cancelled", false);
      }
      const message = error instanceof Error ? error.message.slice(0, 2_000) : "MCP server inspection failed";
      return createRpcError(request.id, "MCP_INSPECTION_FAILED", message || "MCP server inspection failed", false);
    }
  }

  if (request.method === "mcp.resource.read") {
    let invocation;
    try {
      invocation = parseMcpResourceReadInvocation(request.params);
    } catch {
      return createRpcError(request.id, "INVALID_ARGUMENT", "Invalid MCP resource read invocation", false);
    }
    try {
      return createRpcSuccess(
        request.id,
        parseMcpResourceReadResult(await readMcpResource(invocation, signal)),
      );
    } catch (error) {
      if (signal?.aborted) {
        return createRpcError(request.id, "CANCELLED", "Operation cancelled", false);
      }
      const message = error instanceof Error ? error.message.slice(0, 2_000) : "MCP resource read failed";
      return createRpcError(request.id, "MCP_RESOURCE_READ_FAILED", message || "MCP resource read failed", false);
    }
  }

  return createRpcError(request.id, "METHOD_NOT_FOUND", "Unknown AI runtime method", false);
}
