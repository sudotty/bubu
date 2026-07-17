import type { ModelCompletion, ModelInvocation } from "@bubu/contracts";
import { buildProviderRequest } from "./request.js";
import { parseProviderResponse } from "./response.js";

const maxResponseBytes = 10 * 1024 * 1024;

export type ProviderFetch = (input: string, init: RequestInit) => Promise<Response>;

export class ProviderInvocationError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProviderInvocationError";
    this.retryable = retryable;
  }
}

export async function invokeProvider(
  invocation: ModelInvocation,
  fetchProvider: ProviderFetch = fetch,
  signal?: AbortSignal,
): Promise<ModelCompletion> {
  const request = buildProviderRequest(invocation);
  let response: Response;
  try {
    response = await fetchProvider(request.url, {
      ...request.init,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
        : AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new ProviderInvocationError(`${invocation.provider.kind} request could not reach the provider`, true, {
      cause: error,
    });
  }
  const text = await readBoundedText(response);
  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new ProviderInvocationError(
      `${invocation.provider.kind} request failed with HTTP ${response.status}`,
      retryable,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ProviderInvocationError(`${invocation.provider.kind} returned invalid JSON`, false);
  }
  return parseProviderResponse(invocation, value);
}

async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxResponseBytes) {
      await reader.cancel();
      throw new Error("provider response exceeded 10 MiB");
    }
    result += decoder.decode(chunk.value, { stream: true });
  }
  return result + decoder.decode();
}
