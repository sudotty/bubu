import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentDefinitionStore } from "./agent-definition-store.js";

describe("main-owned reusable Agent definitions", () => {
  it("persists, updates, reloads, and removes bounded definitions privately", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bubu-agent-definitions-"));
    let index = 0;
    const store = createAgentDefinitionStore({
      directory,
      now: () => new Date(index++ === 0 ? "2026-07-28T00:00:00.000Z" : "2026-07-28T01:00:00.000Z"),
      createId: () => "a".repeat(32),
    });
    const created = store.save({ schemaVersion: 1, name: "区域审查", description: "检查聚合差异", goal: "找出异常区域并引用单元格。" });
    const updated = store.save({ schemaVersion: 1, id: created.id, name: "区域审查", description: "复核聚合差异", goal: "找出最大区域差异并引用单元格。" });
    expect(updated).toMatchObject({ id: created.id, createdAt: created.createdAt, updatedAt: "2026-07-28T01:00:00.000Z" });
    expect(createAgentDefinitionStore({ directory }).state().definitions).toEqual([updated]);
    expect((await stat(join(directory, "definitions.json"))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(join(directory, "definitions.json"), "utf8"))).toMatchObject({ schemaVersion: 1 });
    expect(store.remove(created.id).definitions).toEqual([]);
  });

  it("rejects unknown updates and duplicate allocated identifiers", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bubu-agent-definitions-"));
    const store = createAgentDefinitionStore({ directory, createId: () => "b".repeat(32) });
    expect(() => store.save({ schemaVersion: 1, id: "a".repeat(32), name: "不存在", description: "不会创建", goal: "不会运行" })).toThrow("does not exist");
    store.save({ schemaVersion: 1, name: "已存在", description: "已有定义", goal: "检查异常" });
    expect(() => store.save({ schemaVersion: 1, name: "重复", description: "重复 ID", goal: "不会保存" })).toThrow("Unable to allocate");
  });
});
