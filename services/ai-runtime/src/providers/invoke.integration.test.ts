import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { parseModelInvocation } from "@bubu/contracts";
import { invokeProvider } from "./invoke.js";

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  servers.clear();
});

describe("provider loopback transport", () => {
  it("executes a real bounded HTTP request without external credentials or billing", async () => {
    let resolveRequest!: (request: { url: string; method: string; body: string }) => void;
    const receivedRequest = new Promise<{ url: string; method: string; body: string }>((resolve) => {
      resolveRequest = resolve;
    });
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        resolveRequest({
          url: request.url ?? "",
          method: request.method ?? "",
          body: Buffer.concat(chunks).toString("utf8"),
        });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({
          output: [{ content: [{ type: "output_text", text: "loopback-ok" }] }],
          usage: { input_tokens: 7, output_tokens: 2, total_tokens: 9 },
        }));
      });
    });
    servers.add(server);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("loopback provider did not bind to a TCP port");

    const result = await invokeProvider(parseModelInvocation({
      provider: {
        id: "a".repeat(32),
        name: "Loopback Ollama",
        kind: "ollama",
        baseUrl: `http://127.0.0.1:${address.port}/v1/`,
        model: "fixture-model",
      },
      credential: "",
      system: "Bounded fixture system instruction",
      user: "Return the fixture response",
      maxOutputTokens: 64,
    }));
    const request = await receivedRequest;

    expect(request.url).toBe("/v1/responses");
    expect(request.method).toBe("POST");
    expect(JSON.parse(request.body)).toMatchObject({ model: "fixture-model", max_output_tokens: 64 });
    expect(result).toMatchObject({
      text: "loopback-ok",
      providerKind: "ollama",
      usage: { inputTokens: 7, outputTokens: 2, totalTokens: 9 },
    });
  });
});
