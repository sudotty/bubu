import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMcpConnectionStore } from "./mcp-connection-store.js";

const configuration = {
  name: "Dictionary",
  command: "/opt/bubu-mcp/bin/dictionary-server",
  args: ["--stdio"],
  environment: [{ name: "DICTIONARY_TOKEN", value: "top-secret" }],
};

function fakeCipher(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encrypt: (value: string) => Buffer.from(`cipher:${value}`, "utf8"),
    decrypt: (value: Buffer) => value.toString("utf8").replace(/^cipher:/u, ""),
  };
}

describe("MCP connection store", () => {
  it("atomically persists public metadata and encrypted write-only environment values", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-store-"));
    const store = createMcpConnectionStore({
      directory,
      cipher: fakeCipher(),
      createId: () => "a".repeat(32),
    });
    const state = store.save(configuration);
    expect(state.connections[0]).toMatchObject({
      id: "a".repeat(32),
      transport: { environmentKeys: ["DICTIONARY_TOKEN"] },
    });
    expect(JSON.stringify(state)).not.toContain("top-secret");
    expect(store.resolve("a".repeat(32)).environment).toEqual({ DICTIONARY_TOKEN: "top-secret" });

    const profilePath = join(directory, "connections", `${"a".repeat(32)}.json`);
    expect(readFileSync(profilePath, "utf8")).not.toContain("top-secret");
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(statSync(join(directory, "connections")).mode & 0o777).toBe(0o700);
    expect(statSync(profilePath).mode & 0o777).toBe(0o600);
  });

  it("preserves omitted existing values, removes omitted keys, and deletes the whole connection", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-store-"));
    const store = createMcpConnectionStore({
      directory,
      cipher: fakeCipher(),
      createId: () => "b".repeat(32),
    });
    const created = store.save({
      ...configuration,
      environment: [
        { name: "DICTIONARY_TOKEN", value: "first" },
        { name: "SECOND_TOKEN", value: "second" },
      ],
    }).connections[0];
    if (!created) throw new Error("connection was not created");
    store.save({
      id: created.id,
      name: "Renamed",
      command: configuration.command,
      args: [],
      environment: [{ name: "DICTIONARY_TOKEN" }],
    });
    expect(store.resolve(created.id)).toMatchObject({
      profile: { name: "Renamed", transport: { environmentKeys: ["DICTIONARY_TOKEN"] } },
      environment: { DICTIONARY_TOKEN: "first" },
    });
    expect(store.remove(created.id).connections).toEqual([]);
    expect(() => store.resolve(created.id)).toThrow("does not exist");
  });

  it("fails closed for missing secrets, unavailable encryption, and corrupt private records", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-mcp-store-"));
    const unavailable = createMcpConnectionStore({
      directory,
      cipher: fakeCipher(false),
      createId: () => "c".repeat(32),
    });
    expect(() => unavailable.save(configuration)).toThrow("encryption is unavailable");
    expect(() => unavailable.save({
      ...configuration,
      environment: [{ name: "DICTIONARY_TOKEN" }],
    })).toThrow("requires a new value");

    const corruptDirectory = mkdtempSync(join(tmpdir(), "bubu-mcp-store-corrupt-"));
    const connectionsDirectory = join(corruptDirectory, "connections");
    const bootstrap = createMcpConnectionStore({ directory: corruptDirectory, cipher: fakeCipher() });
    expect(bootstrap.state().connections).toEqual([]);
    writeFileSync(join(connectionsDirectory, `${"d".repeat(32)}.json`), "{not-json", { mode: 0o600 });
    expect(() => createMcpConnectionStore({ directory: corruptDirectory, cipher: fakeCipher() })).toThrow();
  });
});
