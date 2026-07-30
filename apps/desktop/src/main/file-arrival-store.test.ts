import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createFileArrivalStore } from "./file-arrival-store.js";

describe("file arrival store", () => {
  it("persists only privacy-safe public state and deduplicates a stable file", async () => {
    const root = await mkdtemp(join(tmpdir(), "bubu-arrival-"));
    const watched = join(root, "weekly-inputs");
    const source = join(watched, "sales.csv");
    let id = 0;
    const store = createFileArrivalStore({
      directory: join(root, "state"), now: () => new Date("2026-08-01T00:00:00.000Z"), newId: () => `${++id}`.padStart(32, "a"),
      listDatasets: async () => [{ id: "b".repeat(32), versionId: "c".repeat(32), displayName: "Sales", sourceKind: "csv", sourceName: "sales.csv", rowCount: 1, columnCount: 1, importedAt: "2026-07-01T00:00:00.000Z", version: 1 }],
      watchDirectory: () => ({ close() {} }),
    });
    await store.configure(watched);
    await writeFile(source, "Order,Amount\nA,10\n", { mode: 0o600 });
    await store.recordFile(source);
    await store.recordFile(source);
    const state = await store.state();
    expect(state.items).toHaveLength(1);
    expect(state.items[0]?.candidates[0]).toMatchObject({ datasetId: "b".repeat(32), confidence: "high" });
    expect(JSON.stringify(state)).not.toContain(root);
  });

  it("rejects files outside the approved folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "bubu-arrival-scope-"));
    const watched = join(root, "approved");
    const outside = join(root, "outside.csv");
    const store = createFileArrivalStore({ directory: join(root, "state"), now: () => new Date(), newId: () => "a".repeat(32), listDatasets: async () => [], watchDirectory: () => ({ close() {} }) });
    await store.configure(watched);
    await writeFile(outside, "A\n1\n", { mode: 0o600 });
    await expect(store.recordFile(outside)).rejects.toThrow("approved folder");
  });
});
