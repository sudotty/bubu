import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema, LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import {
  canonicalMcpJson,
  mcpInspectionBudget,
  mcpResourceReadBudget,
  mcpPromptGetBudget,
  mcpToolCallBudget,
  parseMcpInspectionInvocation,
  parseMcpInspectionSnapshot,
  parseMcpResourceReadInvocation,
  parseMcpResourceReadResult,
  parseMcpPromptGetInvocation,
  parseMcpPromptGetResult,
  parseMcpToolCallInvocation,
  parseMcpToolCallResult,
  type McpInspectionInvocation,
  type McpInspectionSnapshot,
  type McpResourceReadInvocation,
  type McpResourceReadResult,
  type McpPromptGetInvocation,
  type McpPromptGetResult,
  type McpToolCallInvocation,
  type McpToolCallResult,
} from "@bubu/contracts";
import { validateMcpToolArguments, validateMcpToolStructuredContent } from "./schema-validator.js";

interface LimitState {
  limited: boolean;
}

interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

function assertMcpActive(
  signal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
  operation: "inspection" | "resource read" | "prompt get" | "tool call",
): void {
  if (signal?.aborted) throw new Error(`MCP ${operation} was cancelled`);
  if (timeoutSignal.aborted) throw new Error(`MCP ${operation} exceeded its 30-second budget`);
}

function boundedText(value: string | undefined, state: LimitState, maximum = 2_000): string | undefined {
  if (value === undefined) return undefined;
  if (value.length <= maximum) return value;
  state.limited = true;
  return value.slice(0, maximum);
}

function optionalTextProperty(
  key: "title" | "description",
  value: string | undefined,
  state: LimitState,
): Partial<Record<"title" | "description", string>> {
  const text = boundedText(value, state);
  return text === undefined ? {} : { [key]: text };
}

function normalizedTool(
  tool: Awaited<ReturnType<Client["listTools"]>>["tools"][number],
  state: LimitState,
) {
  const inputSchemaJson = canonicalMcpJson(tool.inputSchema);
  if (new TextEncoder().encode(inputSchemaJson).byteLength > 16 * 1024) {
    throw new Error(`MCP tool ${tool.name} input schema exceeds 16 KiB`);
  }
  const annotations = tool.annotations === undefined ? undefined : Object.fromEntries(
    (["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const)
      .flatMap((key) => typeof tool.annotations?.[key] === "boolean" ? [[key, tool.annotations[key]]] : []),
  );
  return {
    name: tool.name,
    ...optionalTextProperty("title", tool.title, state),
    ...optionalTextProperty("description", tool.description, state),
    inputSchemaJson,
    taskSupport: tool.execution?.taskSupport ?? "forbidden",
    ...(annotations === undefined || Object.keys(annotations).length === 0 ? {} : { annotations }),
  };
}

function normalizedResource(
  resource: Awaited<ReturnType<Client["listResources"]>>["resources"][number],
  state: LimitState,
) {
  return {
    uri: resource.uri,
    name: resource.name,
    ...optionalTextProperty("title", resource.title, state),
    ...optionalTextProperty("description", resource.description, state),
    ...(resource.mimeType === undefined ? {} : { mimeType: resource.mimeType }),
    ...(resource.size === undefined ? {} : { size: resource.size }),
  };
}

function normalizedPrompt(
  prompt: Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number],
  state: LimitState,
) {
  return {
    name: prompt.name,
    ...optionalTextProperty("title", prompt.title, state),
    ...optionalTextProperty("description", prompt.description, state),
    arguments: (prompt.arguments ?? []).map((argument) => ({
      name: argument.name,
      ...optionalTextProperty("description", argument.description, state),
      required: argument.required ?? false,
    })),
  };
}

async function collectPages<T>(
  enabled: boolean,
  maximumPages: number,
  maximumItems: number,
  list: (cursor: string | undefined) => Promise<Page<T>>,
): Promise<{ readonly items: readonly T[]; readonly limited: boolean }> {
  if (!enabled) return { items: [], limited: false };
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  let limited = false;
  while (pages < maximumPages && items.length < maximumItems) {
    const page = await list(cursor);
    pages += 1;
    const remaining = maximumItems - items.length;
    items.push(...page.items.slice(0, remaining));
    if (page.items.length > remaining) limited = true;
    const nextCursor = page.nextCursor;
    if (nextCursor === undefined) break;
    if (
      pages >= maximumPages ||
      items.length >= maximumItems ||
      cursors.has(nextCursor)
    ) {
      limited = true;
      break;
    }
    cursors.add(nextCursor);
    cursor = nextCursor;
  }
  return { items, limited };
}

function inspectionBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

interface McpLaunchInvocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly workingDirectory: string;
  readonly budget: { readonly maxDurationMs: number };
}

interface McpRequestOptions {
  readonly signal: AbortSignal;
  readonly timeout: number;
  readonly maxTotalTimeout: number;
}

async function withMcpClient<T>(
  invocation: McpLaunchInvocation,
  signal: AbortSignal | undefined,
  timeoutSignal: AbortSignal,
  operation: "inspection" | "resource read" | "prompt get" | "tool call",
  use: (client: Client, requestOptions: McpRequestOptions) => Promise<T>,
): Promise<T> {
  assertMcpActive(signal, timeoutSignal, operation);
  const runSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const transport = new StdioClientTransport({
    command: invocation.command,
    args: [...invocation.args],
    env: { ...invocation.environment },
    cwd: invocation.workingDirectory,
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => undefined);
  const client = new Client({ name: "bubu-mcp-client", version: "0.1.0" }, { capabilities: {} });
  const requestOptions = {
    signal: runSignal,
    timeout: invocation.budget.maxDurationMs,
    maxTotalTimeout: invocation.budget.maxDurationMs,
  };
  try {
    await client.connect(transport, requestOptions);
    assertMcpActive(signal, timeoutSignal, operation);
    return await use(client, requestOptions);
  } catch (error) {
    assertMcpActive(signal, timeoutSignal, operation);
    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function inspectMcpStdioServer(
  value: McpInspectionInvocation,
  signal?: AbortSignal,
  timeoutSignal: AbortSignal = AbortSignal.timeout(mcpInspectionBudget.maxDurationMs),
): Promise<McpInspectionSnapshot> {
  const invocation = parseMcpInspectionInvocation(value);
  return withMcpClient(invocation, signal, timeoutSignal, "inspection", async (client, requestOptions) => {
    const capabilities = client.getServerCapabilities();
    const hasTools = capabilities?.tools !== undefined;
    const hasResources = capabilities?.resources !== undefined;
    const hasPrompts = capabilities?.prompts !== undefined;
    const [toolPages, resourcePages, promptPages] = await Promise.all([
      collectPages(hasTools, invocation.budget.maxPagesPerPrimitive, invocation.budget.maxItemsPerPrimitive, async (cursor) => {
        const page = await client.listTools(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.tools, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      }),
      collectPages(hasResources, invocation.budget.maxPagesPerPrimitive, invocation.budget.maxItemsPerPrimitive, async (cursor) => {
        const page = await client.listResources(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.resources, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      }),
      collectPages(hasPrompts, invocation.budget.maxPagesPerPrimitive, invocation.budget.maxItemsPerPrimitive, async (cursor) => {
        const page = await client.listPrompts(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.prompts, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      }),
    ]);
    assertMcpActive(signal, timeoutSignal, "inspection");
    const state: LimitState = {
      limited: toolPages.limited || resourcePages.limited || promptPages.limited,
    };
    const server = client.getServerVersion();
    if (!server) throw new Error("MCP server did not provide an implementation identity");
    const instructions = boundedText(client.getInstructions(), state) ?? null;
    const tools = toolPages.items.map((tool) => normalizedTool(tool, state));
    const resources = resourcePages.items.map((resource) => normalizedResource(resource, state));
    const prompts = promptPages.items.map((prompt) => normalizedPrompt(prompt, state));
    const snapshot = {
      schemaVersion: 1 as const,
      requestedProtocolVersion: LATEST_PROTOCOL_VERSION,
      server: {
        name: server.name,
        version: server.version,
        ...optionalTextProperty("title", server.title, state),
      },
      capabilities: { tools: hasTools, resources: hasResources, prompts: hasPrompts },
      instructions,
      tools,
      resources,
      prompts,
      limited: state.limited,
      untrustedMetadata: true as const,
    };
    while (inspectionBytes(snapshot) > invocation.budget.maxResultBytes) {
      const target = prompts.length > 0 ? prompts : resources.length > 0 ? resources : tools;
      if (target.length === 0) throw new Error("MCP server identity exceeds the inspection result budget");
      target.pop();
      snapshot.limited = true;
    }
    return parseMcpInspectionSnapshot(snapshot);
  });
}

function decodeCanonicalBase64(value: string): Buffer {
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    throw new Error("MCP resource returned invalid base64 content");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) throw new Error("MCP resource returned non-canonical base64 content");
  return decoded;
}

export async function readMcpStdioResource(
  value: McpResourceReadInvocation,
  signal?: AbortSignal,
  timeoutSignal: AbortSignal = AbortSignal.timeout(mcpResourceReadBudget.maxDurationMs),
): Promise<McpResourceReadResult> {
  const invocation = parseMcpResourceReadInvocation(value);
  return withMcpClient(invocation, signal, timeoutSignal, "resource read", async (client, requestOptions) => {
    const hasResources = client.getServerCapabilities()?.resources !== undefined;
    if (!hasResources) throw new Error("MCP server does not advertise resources");
    const discovered = await collectPages(
      true,
      invocation.budget.maxDiscoveryPages,
      invocation.budget.maxDiscoveredResources,
      async (cursor) => {
        const page = await client.listResources(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.resources, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      },
    );
    const resource = discovered.items.find(({ uri }) => uri === invocation.resourceUri);
    if (!resource) throw new Error("Approved MCP resource is not present in bounded discovery");
    if (resource.size !== undefined && resource.size > invocation.budget.maxDecodedBytes) {
      throw new Error("Approved MCP resource declares a size above the decoded-content budget");
    }
    const response = await client.readResource({ uri: invocation.resourceUri }, requestOptions);
    if (response.contents.length > invocation.budget.maxContentParts) {
      throw new Error("MCP resource returned too many content parts");
    }
    let decodedBytes = 0;
    const contents = response.contents.map((content) => {
      if ("text" in content) {
        const contentBytes = new TextEncoder().encode(content.text).byteLength;
        decodedBytes += contentBytes;
        if (decodedBytes > invocation.budget.maxDecodedBytes) {
          throw new Error("MCP resource exceeds its decoded-content budget");
        }
        return {
          kind: "text" as const,
          uri: content.uri,
          ...(content.mimeType === undefined ? {} : { mimeType: content.mimeType }),
          text: content.text,
          decodedBytes: contentBytes,
        };
      }
      const decoded = decodeCanonicalBase64(content.blob);
      decodedBytes += decoded.byteLength;
      if (decodedBytes > invocation.budget.maxDecodedBytes) {
        throw new Error("MCP resource exceeds its decoded-content budget");
      }
      return {
        kind: "blob" as const,
        uri: content.uri,
        ...(content.mimeType === undefined ? {} : { mimeType: content.mimeType }),
        decodedBytes: decoded.byteLength,
        sha256: createHash("sha256").update(decoded).digest("hex"),
      };
    });
    return parseMcpResourceReadResult({
      schemaVersion: 1,
      connectionId: invocation.connectionId,
      requestedUri: invocation.resourceUri,
      contents,
      decodedBytes,
      localOnly: true,
      untrustedContent: true,
    });
  });
}

type McpContentBlock = Awaited<ReturnType<Client["getPrompt"]>>["messages"][number]["content"];

function normalizedMcpContent(content: McpContentBlock, includeBytes: (bytes: number) => number) {
  if (content.type === "text") {
    return {
      kind: "text" as const,
      text: content.text,
      decodedBytes: includeBytes(new TextEncoder().encode(content.text).byteLength),
    };
  }
  if (content.type === "image" || content.type === "audio") {
    const decoded = decodeCanonicalBase64(content.data);
    return {
      kind: content.type,
      mimeType: content.mimeType,
      decodedBytes: includeBytes(decoded.byteLength),
      sha256: createHash("sha256").update(decoded).digest("hex"),
    };
  }
  if (content.type === "resource") {
    const embedded = content.resource;
    if ("text" in embedded) {
      return {
        kind: "embedded-text" as const,
        uri: embedded.uri,
        ...(embedded.mimeType === undefined ? {} : { mimeType: embedded.mimeType }),
        text: embedded.text,
        decodedBytes: includeBytes(new TextEncoder().encode(embedded.text).byteLength),
      };
    }
    const decoded = decodeCanonicalBase64(embedded.blob);
    return {
      kind: "embedded-blob" as const,
      uri: embedded.uri,
      ...(embedded.mimeType === undefined ? {} : { mimeType: embedded.mimeType }),
      decodedBytes: includeBytes(decoded.byteLength),
      sha256: createHash("sha256").update(decoded).digest("hex"),
    };
  }
  return {
    kind: "resource-link" as const,
    uri: content.uri,
    name: content.name,
    ...(content.title === undefined ? {} : { title: content.title }),
    ...(content.description === undefined ? {} : { description: content.description }),
    ...(content.mimeType === undefined ? {} : { mimeType: content.mimeType }),
    ...(content.size === undefined ? {} : { size: content.size }),
    decodedBytes: 0 as const,
  };
}

export async function getMcpStdioPrompt(
  value: McpPromptGetInvocation,
  signal?: AbortSignal,
  timeoutSignal: AbortSignal = AbortSignal.timeout(mcpPromptGetBudget.maxDurationMs),
): Promise<McpPromptGetResult> {
  const invocation = parseMcpPromptGetInvocation(value);
  return withMcpClient(invocation, signal, timeoutSignal, "prompt get", async (client, requestOptions) => {
    const hasPrompts = client.getServerCapabilities()?.prompts !== undefined;
    if (!hasPrompts) throw new Error("MCP server does not advertise prompts");
    const discovered = await collectPages(
      true,
      invocation.budget.maxDiscoveryPages,
      invocation.budget.maxDiscoveredPrompts,
      async (cursor) => {
        const page = await client.listPrompts(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.prompts, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      },
    );
    const prompt = discovered.items.find(({ name }) => name === invocation.promptName);
    if (!prompt) throw new Error("Approved MCP prompt is not present in bounded discovery");
    const declared = new Map((prompt.arguments ?? []).map((argument) => [argument.name, argument]));
    if (declared.size !== (prompt.arguments ?? []).length) {
      throw new Error("MCP prompt declares duplicate argument names");
    }
    const provided = Object.fromEntries(invocation.arguments.map(({ name, value: argumentValue }) => [name, argumentValue]));
    for (const name of Object.keys(provided)) {
      if (!declared.has(name)) throw new Error(`MCP prompt argument ${name} is not declared`);
    }
    for (const argument of declared.values()) {
      if (argument.required === true && provided[argument.name] === undefined) {
        throw new Error(`MCP prompt required argument ${argument.name} is missing`);
      }
    }
    const response = await client.getPrompt({
      name: invocation.promptName,
      arguments: provided,
    }, requestOptions);
    if (response.messages.length > invocation.budget.maxMessages) {
      throw new Error("MCP prompt returned too many messages");
    }
    let decodedBytes = 0;
    const includeBytes = (bytes: number): number => {
      decodedBytes += bytes;
      if (decodedBytes > invocation.budget.maxDecodedBytes) {
        throw new Error("MCP prompt exceeds its decoded-content budget");
      }
      return bytes;
    };
    const messages = response.messages.map(({ role, content }) => ({
      role,
      content: normalizedMcpContent(content, includeBytes),
    }));
    return parseMcpPromptGetResult({
      schemaVersion: 1,
      connectionId: invocation.connectionId,
      promptName: invocation.promptName,
      ...(response.description === undefined ? {} : { description: response.description }),
      messages,
      decodedBytes,
      localOnly: true,
      untrustedContent: true,
    });
  });
}

export async function callMcpStdioTool(
  value: McpToolCallInvocation,
  signal?: AbortSignal,
  timeoutSignal: AbortSignal = AbortSignal.timeout(mcpToolCallBudget.maxDurationMs),
): Promise<McpToolCallResult> {
  const invocation = parseMcpToolCallInvocation(value);
  return withMcpClient(invocation, signal, timeoutSignal, "tool call", async (client, requestOptions) => {
    const hasTools = client.getServerCapabilities()?.tools !== undefined;
    if (!hasTools) throw new Error("MCP server does not advertise tools");
    const discovered = await collectPages(
      true,
      invocation.budget.maxDiscoveryPages,
      invocation.budget.maxDiscoveredTools,
      async (cursor) => {
        const page = await client.listTools(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.tools, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      },
    );
    const tool = discovered.items.find(({ name }) => name === invocation.toolName);
    if (!tool) throw new Error("Approved MCP tool is not present in bounded discovery");
    const inputSchemaJson = canonicalMcpJson(tool.inputSchema);
    const inputSchemaSha256 = createHash("sha256").update(inputSchemaJson, "utf8").digest("hex");
    if (inputSchemaSha256 !== invocation.inputSchemaSha256) {
      throw new Error("Approved MCP tool input schema changed after review");
    }
    const taskSupport = tool.execution?.taskSupport ?? "forbidden";
    if (taskSupport !== invocation.taskSupport) {
      throw new Error("Approved MCP tool task support changed after review");
    }
    if (taskSupport === "required") {
      throw new Error("MCP task-required tools are not supported by this bounded call path");
    }
    validateMcpToolArguments(inputSchemaJson, invocation.arguments);
    const response = await client.callTool({
      name: invocation.toolName,
      arguments: invocation.arguments,
    }, CallToolResultSchema, requestOptions);
    const normalResponse = CallToolResultSchema.parse(response);
    if (normalResponse.content.length > invocation.budget.maxContentParts) {
      throw new Error("MCP tool returned too many content parts");
    }
    let decodedBytes = 0;
    const includeBytes = (bytes: number): number => {
      decodedBytes += bytes;
      if (decodedBytes > invocation.budget.maxDecodedBytes) {
        throw new Error("MCP tool exceeds its decoded-content budget");
      }
      return bytes;
    };
    const contents = normalResponse.content.map((content) => normalizedMcpContent(content, includeBytes));
    let structuredContent: { readonly json: string; readonly decodedBytes: number } | null = null;
    if (normalResponse.structuredContent !== undefined) {
      if (tool.outputSchema !== undefined) {
        validateMcpToolStructuredContent(tool.outputSchema, normalResponse.structuredContent);
      }
      const json = canonicalMcpJson(normalResponse.structuredContent);
      structuredContent = {
        json,
        decodedBytes: includeBytes(new TextEncoder().encode(json).byteLength),
      };
    } else if (tool.outputSchema !== undefined) {
      throw new Error("MCP tool omitted structured content required by its output schema");
    }
    return parseMcpToolCallResult({
      schemaVersion: 1,
      connectionId: invocation.connectionId,
      toolName: invocation.toolName,
      isError: normalResponse.isError ?? false,
      contents,
      structuredContent,
      decodedBytes,
      localOnly: true,
      untrustedContent: true,
    });
  });
}
