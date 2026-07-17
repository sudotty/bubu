import { randomUUID } from "node:crypto";
import {
  createRpcRequest,
  parseRpcResponse,
  type RpcResponse,
} from "@bubu/contracts";

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
  removeAbortListener?: () => void;
}

export interface RpcRequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export class RpcRemoteError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(`${code}: ${message}`);
    this.name = "RpcRemoteError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class RpcRequestBroker {
  readonly #auth: string;
  readonly #send: (message: unknown) => void;
  readonly #timeoutMs: number;
  readonly #pending = new Map<string, PendingRequest>();
  #closedError: Error | undefined;

  constructor(auth: string, send: (message: unknown) => void, timeoutMs = 5_000) {
    this.#auth = auth;
    this.#send = send;
    this.#timeoutMs = timeoutMs;
  }

  request(
    method: string,
    params: Readonly<Record<string, unknown>>,
    options: RpcRequestOptions = {},
  ): Promise<unknown> {
    if (this.#closedError) return Promise.reject(this.#closedError);
    if (options.signal?.aborted) return Promise.reject(operationCancelledError(method));

    const id = randomUUID();
    const request = createRpcRequest({ auth: this.#auth, id, method, params: { ...params } });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#cancelPending(id, new Error(`RPC request timed out: ${method}`));
      }, options.timeoutMs ?? this.#timeoutMs);
      const pending: PendingRequest = { resolve, reject, timer };
      this.#pending.set(id, pending);

      try {
        this.#send(request);
        if (options.signal) {
          const abort = () => this.#cancelPending(id, operationCancelledError(method));
          options.signal.addEventListener("abort", abort, { once: true });
          pending.removeAbortListener = () => options.signal?.removeEventListener("abort", abort);
          if (options.signal.aborted) abort();
        }
      } catch (error) {
        this.#settlePending(id);
        reject(error instanceof Error ? error : new Error("RPC transport failed"));
      }
    });
  }

  accept(value: unknown): void {
    let response: RpcResponse;
    try {
      response = parseRpcResponse(value);
    } catch {
      return;
    }

    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#settlePending(response.id);

    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(new RpcRemoteError(
      response.error.code,
      response.error.message,
      response.error.retryable,
    ));
  }

  close(error: Error): void {
    if (this.#closedError) return;
    this.#closedError = error;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.removeAbortListener?.();
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #settlePending(id: string): PendingRequest | undefined {
    const pending = this.#pending.get(id);
    if (!pending) return undefined;
    clearTimeout(pending.timer);
    pending.removeAbortListener?.();
    this.#pending.delete(id);
    return pending;
  }

  #cancelPending(id: string, error: Error): void {
    const pending = this.#settlePending(id);
    if (!pending) return;
    try {
      this.#send(createRpcRequest({
        auth: this.#auth,
        id: randomUUID(),
        method: "system.cancel",
        params: { requestId: id },
      }));
    } catch {
      // The original timeout/cancellation remains the actionable error.
    }
    pending.reject(error);
  }
}

function operationCancelledError(method: string): Error {
  const error = new Error(`RPC operation cancelled: ${method}`);
  error.name = "AbortError";
  return error;
}
