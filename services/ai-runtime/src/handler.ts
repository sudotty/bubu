import {
  createRpcError,
  createRpcSuccess,
  parseModelInvocation,
  parseRpcRequest,
  type RpcResponse,
} from "@bubu/contracts";
import {
  invokeProvider,
  ProviderInvocationError,
  type ProviderFetch,
} from "./providers/invoke.js";

const capabilities = [
  "openai-responses",
  "anthropic-messages",
  "gemini-interactions",
  "openai-compatible",
  "ollama",
  "bounded-http",
  "cancellable-requests",
] as const;

export async function handleAiRuntimeRequest(
  value: unknown,
  expectedAuth: string,
  fetchProvider?: ProviderFetch,
  signal?: AbortSignal,
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

  return createRpcError(request.id, "METHOD_NOT_FOUND", "Unknown AI runtime method", false);
}
