import { describe, expect, it, vi } from "vitest";
import type { DerivedRecomputeEvent } from "@bubu/contracts";
import { processDerivedRecomputes, type DerivedRecomputeRuntime } from "./derived-recompute-scheduler.js";

const event: DerivedRecomputeEvent = {
  id: "a".repeat(32), sourceDatasetId: "b".repeat(32), sourceVersionId: "c".repeat(32),
  targetDatasetId: "d".repeat(32), targetDisplayName: "Recurring clean", status: "succeeded",
  reasonKind: null, error: null, resultVersionId: "e".repeat(32), attempt: 1,
  createdAt: "2026-07-27T00:00:00Z", startedAt: "2026-07-27T00:00:01Z", finishedAt: "2026-07-27T00:00:02Z",
};

describe("derived recompute scheduler", () => {
  it("delivers only terminal events returned by the durable processor", async () => {
    const onFinished = vi.fn();
    const runtime: DerivedRecomputeRuntime = { processDerivedRecomputeEvents: async () => [event] };
    await expect(processDerivedRecomputes(runtime, onFinished)).resolves.toEqual([event]);
    expect(onFinished).toHaveBeenCalledWith(event);
  });

  it("is quiet when the idempotent processor has no work", async () => {
    const onFinished = vi.fn();
    await processDerivedRecomputes({ processDerivedRecomputeEvents: async () => [] }, onFinished);
    expect(onFinished).not.toHaveBeenCalled();
  });
});
