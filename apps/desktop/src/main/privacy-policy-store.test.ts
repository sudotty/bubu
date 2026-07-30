import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPrivacyPolicyStore } from "./privacy-policy-store.js";

describe("main-owned privacy policy", () => {
  it("persists a strict policy atomically and fails closed on sensitive prompt text", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bubu-privacy-"));
    const store = createPrivacyPolicyStore(directory);
    expect(store.state().mode).toBe("local-private");
    expect(store.save({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true }).mode).toBe("strict-private");
    expect(JSON.parse(await readFile(join(directory, "policy.json"), "utf8"))).toEqual({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
    expect(() => store.assertModelTextAllowed(["api_key=s", "k-example_12345678901234567890"].join(""))).toThrow("本地隐私检查");
    expect(() => store.assertModelTextAllowed("按区域汇总销售额")).not.toThrow();
  });

  it("uses schema-only for remote strict mode while retaining synthetic context for loopback models", () => {
    const store = createPrivacyPolicyStore(join(tmpdir(), `bubu-privacy-${Date.now()}`));
    store.save({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
    expect(store.disclosureFor("https://api.example.com/v1")).toBe("schema-only");
    expect(store.disclosureFor("http://127.0.0.1:11434/v1")).toBe("schema-synthetic");
    expect(() => store.assertExplicitRowsAllowed("ordinary value")).toThrow("严格隐私模式");
    expect(() => store.assertMcpModelContentAllowed("https://api.example.com/v1", "ordinary metadata")).toThrow("严格隐私模式");
    expect(() => store.assertMcpModelContentAllowed("http://127.0.0.1:11434/v1", "ordinary metadata")).not.toThrow();
  });

  it("permits explicitly selected rows only in local-private mode after local DLP", () => {
    const store = createPrivacyPolicyStore(join(tmpdir(), `bubu-explicit-rows-${Date.now()}`));
    expect(() => store.assertExplicitRowsAllowed("A-1", "10.25")).not.toThrow();
    expect(() => store.assertExplicitRowsAllowed("person@example.com")).toThrow("本地隐私检查");
  });
});
