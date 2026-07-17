import { chmodSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mcpInspectionBudget, type McpConnectionProfile } from "@bubu/contracts";
import { prepareMcpInspectionInvocation } from "./mcp-api.js";

function profile(command: string): McpConnectionProfile {
  return {
    id: "a".repeat(32),
    name: "Dictionary",
    transport: {
      kind: "stdio",
      command,
      args: ["--stdio"],
      environmentKeys: ["DICTIONARY_TOKEN"],
    },
  };
}

describe("MCP inspection launch preparation", () => {
  it("binds the canonical executable, exact environment, private runtime, and fixed budget", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-api-"));
    const executable = join(root, "server");
    const alias = join(root, "server-alias");
    writeFileSync(executable, "#!/bin/sh\n", { mode: 0o700 });
    symlinkSync(executable, alias);
    const invocation = prepareMcpInspectionInvocation(
      { profile: profile(alias), environment: { DICTIONARY_TOKEN: "secret" } },
      join(root, "runtimes"),
    );
    expect(invocation).toEqual({
      connectionId: "a".repeat(32),
      command: realpathSync(executable),
      args: ["--stdio"],
      environment: { DICTIONARY_TOKEN: "secret" },
      workingDirectory: join(root, "runtimes", "a".repeat(32)),
      budget: mcpInspectionBudget,
    });
  });

  it("rejects a missing, non-file, or non-executable launch target", () => {
    const root = mkdtempSync(join(tmpdir(), "bubu-mcp-api-"));
    const notExecutable = join(root, "server");
    writeFileSync(notExecutable, "binary", { mode: 0o600 });
    chmodSync(notExecutable, 0o600);
    expect(() => prepareMcpInspectionInvocation(
      { profile: profile(notExecutable), environment: { DICTIONARY_TOKEN: "secret" } },
      join(root, "runtimes"),
    )).toThrow("not executable");
    expect(() => prepareMcpInspectionInvocation(
      { profile: profile(join(root, "missing")), environment: { DICTIONARY_TOKEN: "secret" } },
      join(root, "runtimes"),
    )).toThrow();
  });
});
