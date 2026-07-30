import { describe, expect, it } from "vitest";
import { deriveRecurringWorkItems } from "./recurring-work.js";

describe("recurring work center policy", () => {
  it("deduplicates each durable task and orders actionable work first", () => {
    const items = deriveRecurringWorkItems({
      recomputes: [
        { id: "old", targetDatasetId: "derived", targetDisplayName: "月报", status: "failed", reasonKind: "execution-error", attempt: 1, createdAt: "2026-07-01T00:00:00Z", finishedAt: "2026-07-01T00:00:01Z" },
        { id: "new", targetDatasetId: "derived", targetDisplayName: "月报", status: "succeeded", reasonKind: null, attempt: 2, createdAt: "2026-07-02T00:00:00Z", finishedAt: "2026-07-02T00:00:01Z" },
      ],
      reconciliations: [{ id: "reconcile", definitionId: "definition", triggerDatasetId: "source", status: "paused", reasonKind: "quality-change", attempt: 1, createdAt: "2026-07-03T00:00:00Z", finishedAt: "2026-07-03T00:00:01Z" }],
      workflows: [{ id: "workflow", name: "每周检查", target: { kind: "group", id: "group" }, triggerKind: "dataset-version", nextDueAt: null, updatedAt: "2026-07-04T00:00:00Z", latestRun: null }],
      groupForDataset: new Map([["source", { id: "group", name: "经营周报" }]]),
    });
    expect(items.map(({ id, state }) => [id, state])).toEqual([["reconcile", "needs-attention"], ["workflow", "waiting-file"], ["new", "completed"]]);
    expect(items[0]).toMatchObject({ targetKind: "group", targetId: "group", recoverable: true });
  });

  it("does not offer unsafe retry after the bounded attempt limit", () => {
    const [item] = deriveRecurringWorkItems({ recomputes: [{ id: "failed", targetDatasetId: "derived", targetDisplayName: "月报", status: "failed", reasonKind: "execution-error", attempt: 3, createdAt: "2026-07-01T00:00:00Z", finishedAt: "2026-07-01T00:00:01Z" }], reconciliations: [], workflows: [], groupForDataset: new Map() });
    expect(item).toMatchObject({ state: "needs-attention", recoverable: false });
  });
});
