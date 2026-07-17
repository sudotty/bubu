import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import {
  createRpcRequest,
  mcpInspectionBudget,
  mcpResourceReadBudget,
  parseMcpInspectionSnapshot,
  parseMcpResourceReadResult,
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
  console.log("MCP smoke passed: authenticated isolated stdio discovery invoked nothing; the separately approved exact URI invoked one resource, returned bounded local-only text/blob metadata, exposed no blob bytes, and cleaned up both child trees.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
