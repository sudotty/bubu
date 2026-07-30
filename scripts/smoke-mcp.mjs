import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import {
  createRpcRequest,
  mcpInspectionBudget,
  mcpPromptGetBudget,
  mcpResourceReadBudget,
  mcpToolCallBudget,
  parseMcpInspectionSnapshot,
  parseMcpPromptGetResult,
  parseMcpResourceReadResult,
  parseMcpToolCallResult,
  parseRpcResponse,
} from "@bubu/contracts";

const root = mkdtempSync(resolve(tmpdir(), "bubu-mcp-smoke-"));
const sentinel = resolve(root, "invoked.txt");
const fixture = resolve("scripts/fixtures/mcp-inspection-server.mjs");
const runtime = resolve("services/ai-runtime/dist/index.cjs");
const connectionId = "a".repeat(32);

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function requestRuntime(method, params) {
  const auth = randomBytes(32).toString("hex");
  const child = spawn(process.execPath, [runtime], {
    cwd: root,
    env: { BUBU_RPC_TOKEN: auth },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    if (stderr.length < 8_192) stderr += chunk.toString("utf8").slice(0, 8_192 - stderr.length);
  });
  try {
    const responsePromise = new Promise((resolveResponse, reject) => {
      const timeout = setTimeout(() => reject(new Error(`MCP smoke RPC timed out: ${method}`)), 35_000);
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      lines.once("line", (line) => {
        clearTimeout(timeout);
        try {
          resolveResponse(parseRpcResponse(JSON.parse(line)));
        } catch (error) {
          reject(error);
        } finally {
          lines.close();
        }
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`AI runtime exited before ${method} response (code=${code}, signal=${signal}): ${stderr}`));
      });
    });
    child.stdin.write(`${JSON.stringify(createRpcRequest({
      auth,
      id: randomUUID(),
      method,
      params,
    }))}\n`);
    const response = await responsePromise;
    if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
    return response.result;
  } finally {
    await stopChild(child);
  }
}

try {
  const launch = {
    connectionId,
    command: process.execPath,
    args: [fixture],
    environment: { FIXTURE_SENTINEL: sentinel },
    workingDirectory: root,
  };
  const snapshot = parseMcpInspectionSnapshot(await requestRuntime("mcp.inspect", {
    ...launch,
    budget: mcpInspectionBudget,
  }));
  if (
    snapshot.server.name !== "bubu-inspection-fixture" ||
    snapshot.server.title !== "Isolated MCP fixture" ||
    snapshot.tools.length !== 1 ||
    snapshot.resources.length !== 1 ||
    snapshot.prompts.length !== 1 ||
    existsSync(sentinel)
  ) {
    throw new Error(`MCP smoke violated inspection-only isolation: ${JSON.stringify(snapshot)}`);
  }

  const resource = parseMcpResourceReadResult(await requestRuntime("mcp.resource.read", {
    ...launch,
    resourceUri: "bubu-dictionary://definitions",
    budget: mcpResourceReadBudget,
  }));
  if (
    resource.contents.length !== 2 ||
    resource.decodedBytes !== 51 ||
    resource.contents[0]?.kind !== "text" ||
    resource.contents[1]?.kind !== "blob" ||
    "blob" in resource.contents[1] ||
    readFileSync(sentinel, "utf8") !== "resource\n" ||
    JSON.stringify(resource).includes("YmluYXJ5IGZpeHR1cmU=")
  ) {
    throw new Error(`MCP smoke violated approved local resource policy: ${JSON.stringify(resource)}`);
  }
  rmSync(sentinel, { force: true });
  const prompt = parseMcpPromptGetResult(await requestRuntime("mcp.prompt.get", {
    ...launch,
    promptName: "explain_term",
    arguments: [{ name: "term", value: "gross margin" }],
    budget: mcpPromptGetBudget,
  }));
  if (
    prompt.messages.length !== 4 ||
    prompt.decodedBytes !== 41 ||
    prompt.messages[0]?.content.kind !== "text" ||
    prompt.messages[1]?.content.kind !== "image" ||
    prompt.messages[2]?.content.kind !== "embedded-text" ||
    prompt.messages[3]?.content.kind !== "resource-link" ||
    readFileSync(sentinel, "utf8") !== "prompt\n" ||
    JSON.stringify(prompt).includes("YmluYXJ5IGZpeHR1cmU=")
  ) {
    throw new Error(`MCP smoke violated approved local prompt policy: ${JSON.stringify(prompt)}`);
  }
  rmSync(sentinel, { force: true });
  const inputSchemaJson = snapshot.tools[0]?.inputSchemaJson;
  if (!inputSchemaJson) throw new Error("MCP smoke fixture did not expose its tool input schema");
  const tool = parseMcpToolCallResult(await requestRuntime("mcp.tool.call", {
    ...launch,
    toolName: "lookup_term",
    inputSchemaSha256: createHash("sha256").update(inputSchemaJson, "utf8").digest("hex"),
    taskSupport: "forbidden",
    arguments: { term: "gross margin" },
    budget: mcpToolCallBudget,
  }));
  if (
    tool.toolName !== "lookup_term" ||
    tool.isError ||
    tool.contents[0]?.kind !== "text" ||
    tool.structuredContent?.json !== "{\"definition\":\"Definition for gross margin\"}" ||
    tool.decodedBytes !== 71 ||
    readFileSync(sentinel, "utf8") !== "tool\n"
  ) {
    throw new Error(`MCP smoke violated approved local tool policy: ${JSON.stringify(tool)}`);
  }

  const demoLaunch = {
    connectionId: "b".repeat(32),
    command: resolve("services/data-core/bin", process.platform === "win32" ? "bubu-mcp-demo.exe" : "bubu-mcp-demo"),
    args: [],
    environment: {},
    workingDirectory: root,
  };
  const demoSnapshot = parseMcpInspectionSnapshot(await requestRuntime("mcp.inspect", { ...demoLaunch, budget: mcpInspectionBudget }));
  if (demoSnapshot.server.name !== "bubu-demo-mcp" || demoSnapshot.tools.length !== 1 || demoSnapshot.prompts.length !== 1 || demoSnapshot.resources.length !== 0) {
    throw new Error(`Bundled MCP demo discovery failed: ${JSON.stringify(demoSnapshot)}`);
  }
  const demoPrompt = parseMcpPromptGetResult(await requestRuntime("mcp.prompt.get", { ...demoLaunch, promptName: "explain_term", arguments: [{ name: "term", value: "gross_margin" }], budget: mcpPromptGetBudget }));
  if (demoPrompt.messages[0]?.content.kind !== "text" || !demoPrompt.messages[0].content.text.includes("gross_margin")) {
    throw new Error(`Bundled MCP demo prompt failed: ${JSON.stringify(demoPrompt)}`);
  }
  const demoSchema = demoSnapshot.tools[0]?.inputSchemaJson;
  if (!demoSchema) throw new Error("Bundled MCP demo did not expose a tool schema");
  const demoTool = parseMcpToolCallResult(await requestRuntime("mcp.tool.call", { ...demoLaunch, toolName: "lookup_term", inputSchemaSha256: createHash("sha256").update(demoSchema).digest("hex"), taskSupport: "forbidden", arguments: { term: "gross_margin" }, budget: mcpToolCallBudget }));
  if (demoTool.isError || demoTool.contents[0]?.kind !== "text" || !demoTool.contents[0].text.includes("synthetic business definition")) {
    throw new Error(`Bundled MCP demo tool failed: ${JSON.stringify(demoTool)}`);
  }
  console.log("MCP smoke passed: discovery invoked nothing; separately approved exact resource, prompt, and tool requests each invoked one primitive; the packaged read-only demo completed discovery, prompt, and tool-call journeys; every child tree was cleaned up.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
