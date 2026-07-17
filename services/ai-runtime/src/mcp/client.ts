import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import {
  mcpInspectionBudget,
  parseMcpInspectionInvocation,
  parseMcpInspectionSnapshot,
  type McpInspectionInvocation,
  type McpInspectionSnapshot,
} from "@bubu/contracts";

interface LimitState {
  limited: boolean;
}

interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}

function assertInspectionActive(signal: AbortSignal | undefined, timeoutSignal: AbortSignal): void {
  if (signal?.aborted) throw new Error("MCP inspection was cancelled");
  if (timeoutSignal.aborted) throw new Error("MCP inspection exceeded its 30-second budget");
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
  const inputSchemaJson = JSON.stringify(tool.inputSchema);
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
  list: (cursor: string | undefined) => Promise<Page<T>>,
): Promise<{ readonly items: readonly T[]; readonly limited: boolean }> {
  if (!enabled) return { items: [], limited: false };
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;
  let limited = false;
  while (pages < mcpInspectionBudget.maxPagesPerPrimitive && items.length < mcpInspectionBudget.maxItemsPerPrimitive) {
    const page = await list(cursor);
    pages += 1;
    const remaining = mcpInspectionBudget.maxItemsPerPrimitive - items.length;
    items.push(...page.items.slice(0, remaining));
    if (page.items.length > remaining) limited = true;
    const nextCursor = page.nextCursor;
    if (nextCursor === undefined) break;
    if (
      pages >= mcpInspectionBudget.maxPagesPerPrimitive ||
      items.length >= mcpInspectionBudget.maxItemsPerPrimitive ||
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

export async function inspectMcpStdioServer(
  value: McpInspectionInvocation,
  signal?: AbortSignal,
  timeoutSignal: AbortSignal = AbortSignal.timeout(mcpInspectionBudget.maxDurationMs),
): Promise<McpInspectionSnapshot> {
  const invocation = parseMcpInspectionInvocation(value);
  assertInspectionActive(signal, timeoutSignal);
  const runSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const transport = new StdioClientTransport({
    command: invocation.command,
    args: [...invocation.args],
    env: { ...invocation.environment },
    cwd: invocation.workingDirectory,
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => undefined);
  const client = new Client({ name: "bubu-mcp-inspector", version: "0.1.0" }, { capabilities: {} });
  const requestOptions = {
    signal: runSignal,
    timeout: invocation.budget.maxDurationMs,
    maxTotalTimeout: invocation.budget.maxDurationMs,
  };
  try {
    await client.connect(transport, requestOptions);
    assertInspectionActive(signal, timeoutSignal);
    const capabilities = client.getServerCapabilities();
    const hasTools = capabilities?.tools !== undefined;
    const hasResources = capabilities?.resources !== undefined;
    const hasPrompts = capabilities?.prompts !== undefined;
    const [toolPages, resourcePages, promptPages] = await Promise.all([
      collectPages(hasTools, async (cursor) => {
        const page = await client.listTools(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.tools, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      }),
      collectPages(hasResources, async (cursor) => {
        const page = await client.listResources(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.resources, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      }),
      collectPages(hasPrompts, async (cursor) => {
        const page = await client.listPrompts(cursor === undefined ? undefined : { cursor }, requestOptions);
        return { items: page.prompts, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) };
      }),
    ]);
    assertInspectionActive(signal, timeoutSignal);
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
  } catch (error) {
    assertInspectionActive(signal, timeoutSignal);
    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}
