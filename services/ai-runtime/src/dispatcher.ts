import {
  createRpcError,
  createRpcSuccess,
  parseRpcRequest,
  type RpcResponse,
} from "@bubu/contracts";
import { handleAiRuntimeRequest } from "./handler.js";
import type { McpInspector, McpPromptGetter, McpResourceReader } from "./handler.js";
import type { ProviderFetch } from "./providers/invoke.js";

export interface AiRuntimeDispatcher {
  dispatch(value: unknown): Promise<RpcResponse>;
}

export function createAiRuntimeDispatcher(
  expectedAuth: string,
  fetchProvider?: ProviderFetch,
  inspectMcp?: McpInspector,
  readMcpResource?: McpResourceReader,
  getMcpPrompt?: McpPromptGetter,
): AiRuntimeDispatcher {
  const active = new Map<string, AbortController>();
  return {
    async dispatch(value) {
      let request;
      try {
        request = parseRpcRequest(value);
      } catch {
        return createRpcError("invalid-request", "INVALID_REQUEST", "Invalid RPC request", false);
      }
      if (request.auth !== expectedAuth) {
        return createRpcError(request.id, "UNAUTHORIZED", "Invalid process credential", false);
      }
      if (request.method === "system.cancel") {
        const requestId = request.params.requestId;
        if (typeof requestId !== "string" || requestId.length === 0 || requestId.length > 128 || requestId === request.id) {
          return createRpcError(request.id, "INVALID_ARGUMENT", "requestId is invalid", false);
        }
        const controller = active.get(requestId);
        controller?.abort();
        return createRpcSuccess(request.id, { requestId, cancelled: controller !== undefined });
      }
      if (active.has(request.id)) {
        return createRpcError(request.id, "DUPLICATE_REQUEST", "Request id is already active", false);
      }
      const controller = new AbortController();
      active.set(request.id, controller);
      try {
        return await handleAiRuntimeRequest(
          request,
          expectedAuth,
          fetchProvider,
          controller.signal,
          inspectMcp,
          readMcpResource,
          getMcpPrompt,
        );
      } finally {
        active.delete(request.id);
      }
    },
  };
}
