import type { ModelInvocation, ProviderKind } from "@bubu/contracts";

export interface ProviderHttpRequest {
  readonly url: string;
  readonly init: {
    readonly method: "POST";
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string;
  };
}

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function buildProviderRequest(invocation: ModelInvocation): ProviderHttpRequest {
  const baseUrl = parseProviderBaseUrl(invocation.provider.baseUrl);
  if (invocation.provider.kind !== "ollama" && invocation.credential.trim() === "") {
    throw new Error(`${invocation.provider.kind} requires a credential`);
  }

  switch (invocation.provider.kind) {
    case "openai":
      return responsesRequest(baseUrl, invocation, bearerHeaders(invocation.credential));
    case "ollama":
      return responsesRequest(
        baseUrl,
        invocation,
        invocation.credential ? bearerHeaders(invocation.credential) : {},
      );
    case "openai-compatible":
      return chatCompletionsRequest(baseUrl, invocation);
    case "anthropic":
      return jsonRequest(baseUrl, "messages", {
        "x-api-key": invocation.credential,
        "anthropic-version": "2023-06-01",
      }, {
        model: invocation.provider.model,
        max_tokens: invocation.maxOutputTokens,
        system: invocation.system,
        messages: [{ role: "user", content: invocation.user }],
      });
    case "gemini":
      return jsonRequest(baseUrl, "interactions", {
        "x-goog-api-key": invocation.credential,
      }, {
        model: invocation.provider.model,
        system_instruction: invocation.system,
        input: invocation.user,
        store: false,
        generation_config: { max_output_tokens: invocation.maxOutputTokens },
      });
  }
}

export function parseProviderBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopbackHosts.has(url.hostname))) {
    throw new Error("provider base URL must use HTTPS or loopback HTTP");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("provider base URL cannot contain credentials, query, or fragment");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function responsesRequest(
  baseUrl: URL,
  invocation: ModelInvocation,
  headers: Readonly<Record<string, string>>,
): ProviderHttpRequest {
  return jsonRequest(baseUrl, "responses", headers, {
    model: invocation.provider.model,
    instructions: invocation.system,
    input: invocation.user,
    store: false,
    max_output_tokens: invocation.maxOutputTokens,
  });
}

function chatCompletionsRequest(baseUrl: URL, invocation: ModelInvocation): ProviderHttpRequest {
  return jsonRequest(baseUrl, "chat/completions", bearerHeaders(invocation.credential), {
    model: invocation.provider.model,
    messages: [
      { role: "system", content: invocation.system },
      { role: "user", content: invocation.user },
    ],
    max_tokens: invocation.maxOutputTokens,
  });
}

function bearerHeaders(credential: string): Readonly<Record<string, string>> {
  return { authorization: `Bearer ${credential}` };
}

function jsonRequest(
  baseUrl: URL,
  path: string,
  headers: Readonly<Record<string, string>>,
  body: unknown,
): ProviderHttpRequest {
  return {
    url: new URL(path, baseUrl).toString(),
    init: {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  };
}

export function providerTransport(kind: ProviderKind): "responses" | "messages" | "interactions" | "chat-completions" {
  if (kind === "openai" || kind === "ollama") return "responses";
  if (kind === "anthropic") return "messages";
  if (kind === "gemini") return "interactions";
  return "chat-completions";
}
