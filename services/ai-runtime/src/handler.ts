import {
  createRpcError,
  createRpcSuccess,
  parseRpcRequest,
  type RpcResponse,
} from "@bubu/contracts";

const capabilities = ["provider-registry", "streaming", "tools", "mcp"] as const;

export function handleAiRuntimeRequest(value: unknown, expectedAuth: string): RpcResponse {
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

  return createRpcError(request.id, "METHOD_NOT_FOUND", "Unknown AI runtime method", false);
}
