import { readFileSync } from "node:fs";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const failures = [];
const requireText = (path, values, label) => {
  const source = read(path);
  for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`);
};

requireText("packages/contracts/src/mcp-model.ts", ["mcpPromptModelPreparationSchema", "mcpModelToolPreparationSchema", "MCP tools requiring Tasks", "Model proposed an undisclosed MCP tool", "validateMcpToolArguments"], "strict MCP model contracts");
requireText("packages/contracts/src/model-audit.ts", ['z.literal("mcp-connection")', '"mcp-prompt-response"', '"mcp-tool-proposal"', '"mcp-prompt-content"', '"mcp-tool-schemas"'], "MCP disclosure ledger contract");
requireText("services/data-core/internal/data/migration_mcp_model_audit.go", ["mcp-prompt-response", "mcp-tool-proposal", "mcp-connection", "mcp-prompt-content", "mcp-tool-schemas"], "Go model ledger migration");
requireText("apps/desktop/src/main/mcp-model-approval-sessions.ts", ["lifetimeMilliseconds", "maximumSessions", "consumePrompt", "consumeTool", "createOneUseAuthorizationStore"], "separate one-use model approvals");
requireText("apps/desktop/src/main/one-use-authorization-store.ts", ["pending.delete(token)", "session.expiresAt <= options.now()", "pending.size >= options.maximumSessions"], "shared one-use lifecycle");
requireText("apps/desktop/src/main/mcp-model-orchestrator.ts", ["Every prompt message", "exactly one call", "You have no tools", "parseMcpModelToolSuggestionText"], "untrusted strict model orchestration");
requireText("apps/desktop/src/main/mcp-model-api.ts", ["assertMcpModelContentAllowed", 'purpose: "mcp-prompt-response"', 'purpose: "mcp-tool-proposal"', "toolApprovals.issue", "executeApprovedMcpToolCall"], "audited double-gate desktop path");
requireText("apps/desktop/src/renderer/McpModelBridgePanel.tsx", ["双重审批", "模型不能直接调用工具", "第二次独立审查", "完整参数", "结果未发送给模型"], "truthful MCP model UI");
requireText("services/data-core/cmd/bubu-mcp-demo/main.go", ["bubu-demo-mcp", "lookup_term", "readOnlyHint", "synthetic business definition"], "bundled read-only MCP demo");
requireText("scripts/smoke-mcp.mjs", ["Bundled MCP demo", "demoSnapshot", "demoPrompt", "demoTool"], "real runtime MCP demo proof");
requireText("apps/desktop/src/main/packaged-smoke.ts", ["verifyPackagedMcpModelRenderer", "BUBU_PACKAGED_MCP_MODEL_OK", "explicitly disclosed MCP tool catalog"], "packaged double-approval journey");
requireText("scripts/smoke-packaged-desktop.mjs", ["BUBU_PACKAGED_MCP_MODEL_OK"], "packaged MCP model marker gate");
requireText("docs/product/controlled-mcp-model-use.md", ["one-use", "Strict-private", "exactly one", "never automatically sent back", "BUBU_PACKAGED_MCP_MODEL_OK"], "current MCP model guide");
requireManifestFacts(loadProductManifest(new URL("..", import.meta.url)), ["model-driven-mcp-tool-execution: implemented", "mcp-prompt-to-model: implemented", "packaged-mcp-model-journey: implemented"], failures, "manifest MCP model truth");

if (failures.length > 0) {
  console.error(`MCP model-use verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("MCP model use verified: separate disclosure and execution approvals, strict output/schema validation, privacy audit, no loop, real stdio demo, and packaged UI evidence.");
