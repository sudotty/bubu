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

  request(method: string, params: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (this.#closedError) return Promise.reject(this.#closedError);

    const id = randomUUID();
    const request = createRpcRequest({ auth: this.#auth, id, method, params: { ...params } });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`RPC request timed out: ${method}`));
      }, this.#timeoutMs);
      this.#pending.set(id, { resolve, reject, timer });

      try {
        this.#send(request);
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
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
    clearTimeout(pending.timer);
    this.#pending.delete(response.id);

    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
  }

  close(error: Error): void {
    if (this.#closedError) return;
    this.#closedError = error;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }
}
