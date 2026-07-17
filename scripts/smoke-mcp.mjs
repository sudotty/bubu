import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { createRpcRequest, mcpInspectionBudget, parseMcpInspectionSnapshot, parseRpcResponse } from "@bubu/contracts";

const root = mkdtempSync(resolve(tmpdir(), "bubu-mcp-smoke-"));
const sentinel = resolve(root, "invoked.txt");
const auth = randomBytes(32).toString("hex");
const child = spawn(process.execPath, [resolve("services/ai-runtime/dist/index.cjs")], {
  cwd: root,
  env: { BUBU_RPC_TOKEN: auth },
  stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => {
  if (stderr.length < 8_192) stderr += chunk.toString("utf8").slice(0, 8_192 - stderr.length);
});

async function stopChild() {
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

try {
  const responsePromise = new Promise((resolveResponse, reject) => {
    const timeout = setTimeout(() => reject(new Error("MCP smoke RPC timed out")), 35_000);
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
      reject(new Error(`AI runtime exited before MCP smoke response (code=${code}, signal=${signal}): ${stderr}`));
    });
  });
  child.stdin.write(`${JSON.stringify(createRpcRequest({
    auth,
    id: randomUUID(),
    method: "mcp.inspect",
    params: {
      connectionId: "a".repeat(32),
      command: process.execPath,
      args: [resolve("scripts/fixtures/mcp-inspection-server.mjs")],
      environment: { FIXTURE_SENTINEL: sentinel },
      workingDirectory: root,
      budget: mcpInspectionBudget,
    },
  }))}\n`);
  const response = await responsePromise;
  if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
  const snapshot = parseMcpInspectionSnapshot(response.result);
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
  console.log("MCP smoke passed: authenticated utility RPC, isolated stdio lifecycle, bounded tools/resources/prompts discovery, zero primitive invocation, and child cleanup.");
} finally {
  await stopChild();
  rmSync(root, { recursive: true, force: true });
}
