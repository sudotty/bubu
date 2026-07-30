import { describe, expect, it, vi } from "vitest";
import { callMcpRemoteTool, createSafeRemoteFetch, inspectMcpRemoteServer } from "./client.js";
import { canonicalMcpJson, mcpInspectionBudget, mcpToolCallBudget } from "@bubu/contracts";
import { createHash } from "node:crypto";

describe("remote MCP safe fetch", () => {
  it("rejects cross-origin redirects before credentials can be replayed", async () => {
    const resolve = vi.fn(async (hostname: string) => hostname === "mcp.example.com" ? ["93.184.216.34"] : ["127.0.0.1"]);
    const seen = vi.fn(async (request: Request) => {
      expect(request.headers.get("authorization")).toBe("Bearer secret-token");
      return new Response(null, { status: 307, headers: { location: "https://private.example.com/rpc" } });
    });
    const safeFetch = createSafeRemoteFetch({ resolve, fetch: seen });
    await expect(safeFetch("https://mcp.example.com/rpc", { method: "GET", headers: { authorization: "Bearer secret-token" } })).rejects.toThrow("cross-origin");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("passes the validated DNS answer to the socket-bound fetch adapter", async () => {
    const fetchBound = vi.fn(async (_request: Request, addresses: readonly string[]) => {
      expect(addresses).toEqual(["93.184.216.34"]);
      return new Response("ok", { status: 200 });
    });
    const safeFetch = createSafeRemoteFetch({ resolve: async () => ["93.184.216.34"], fetch: fetchBound });
    await expect((await safeFetch("https://mcp.example.com/rpc")).text()).resolves.toBe("ok");
    expect(fetchBound).toHaveBeenCalledTimes(1);
  });

  it("rejects method-changing redirects and caps redirect loops", async () => {
    const resolve = async () => ["93.184.216.34"];
    const changing = createSafeRemoteFetch({ resolve, fetch: async () => new Response(null, { status: 302, headers: { location: "https://mcp.example.com/next" } }) });
    await expect(changing("https://mcp.example.com/rpc", { method: "POST", body: "{}" })).rejects.toThrow("method-changing");
    const looping = createSafeRemoteFetch({ resolve, fetch: async () => new Response(null, { status: 307, headers: { location: "https://mcp.example.com/next" } }) });
    await expect(looping("https://mcp.example.com/rpc", { method: "GET" })).rejects.toThrow("redirect budget");
  });

  it("negotiates and normalizes a bounded Streamable HTTP server", async () => {
    const remoteFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init);
      if (request.method === "DELETE") return new Response(null, { status: 200 });
      if (request.method === "GET") return new Response(null, { status: 405 });
      const message = JSON.parse(await request.text()) as { readonly id?: string | number; readonly method?: string };
      if (message.id === undefined) return new Response(null, { status: 202 });
      const result = message.method === "initialize"
        ? { protocolVersion: "2025-11-25", capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: "remote-fixture", version: "1.0.0" } }
        : message.method === "tools/list"
          ? { tools: [{ name: "lookup", description: "read one value", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } }] }
          : message.method === "resources/list" ? { resources: [] } : { prompts: [] };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const snapshot = await inspectMcpRemoteServer({ connectionId: "a".repeat(32), serverUrl: "https://mcp.example.com/rpc", resolvedAddresses: ["93.184.216.34"], budget: mcpInspectionBudget }, undefined, remoteFetch);
    expect(snapshot).toMatchObject({ server: { name: "remote-fixture" }, tools: [{ name: "lookup" }], untrustedMetadata: true });
  });

  it("re-discovers the exact schema before one remote tool call", async () => {
    const schema = { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false };
    const remoteFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const request = new Request(input, init); if (request.method === "DELETE") return new Response(null, { status: 200 });
      const message = JSON.parse(await request.text()) as { readonly id?: string | number; readonly method?: string };
      if (message.id === undefined) return new Response(null, { status: 202 });
      const result = message.method === "initialize" ? { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "remote-fixture", version: "1.0.0" } } : message.method === "tools/list" ? { tools: [{ name: "lookup", inputSchema: schema }] } : { content: [{ type: "text", text: "value 42" }], isError: false };
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const result = await callMcpRemoteTool({ connectionId: "a".repeat(32), serverUrl: "https://mcp.example.com/rpc", resolvedAddresses: ["93.184.216.34"], toolName: "lookup", inputSchemaSha256: createHash("sha256").update(canonicalMcpJson(schema)).digest("hex"), taskSupport: "forbidden", arguments: { id: "42" }, budget: mcpToolCallBudget }, undefined, remoteFetch);
    expect(result).toMatchObject({ toolName: "lookup", contents: [{ kind: "text", text: "value 42" }], localOnly: true, untrustedContent: true });
  });
});
