import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProductMetricsStore } from "./product-metrics.js";

describe("local product metrics store", () => {
  it("writes a local versioned event without product content", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bubu-metrics-"));
    const store = createProductMetricsStore(directory, () => new Date("2026-07-20T00:00:00.000Z"));
    await store.record({ name: "artifact_copied", rowCount: 3, columnCount: 2, outcome: "succeeded" });
    expect(JSON.parse(await readFile(join(directory, "events.ndjson"), "utf8"))).toEqual({ schemaVersion: 1, occurredAt: "2026-07-20T00:00:00.000Z", name: "artifact_copied", rowCount: 3, columnCount: 2, outcome: "succeeded" });
    await expect(store.record({ name: "artifact_copied", question: "secret" })).rejects.toThrow();
  });
});
