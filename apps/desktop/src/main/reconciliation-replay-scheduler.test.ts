import { describe, expect, it, vi } from "vitest";
import type { ReconciliationReplayEvent } from "@bubu/contracts";
import { processReconciliationReplays } from "./reconciliation-replay-scheduler.js";

const event: ReconciliationReplayEvent = {
  schemaVersion: 1,
  id: "a".repeat(32),
  definitionId: "b".repeat(32),
  triggerDatasetId: "c".repeat(32),
  triggerVersionId: "d".repeat(32),
  status: "paused",
  reasonKind: "cardinality-change",
  error: "Reviewed limits changed",
  artifactId: null,
  attempt: 1,
  createdAt: "2026-07-27T00:00:00Z",
  startedAt: "2026-07-27T00:00:01Z",
  finishedAt: "2026-07-27T00:00:02Z",
};

describe("reconciliation replay scheduler", () => {
  it("delivers durable terminal events without source values", async () => {
    const onFinished = vi.fn();
    await expect(processReconciliationReplays({ processReconciliationReplayEvents: async () => [event] }, onFinished)).resolves.toEqual([event]);
    expect(onFinished).toHaveBeenCalledWith(event);
  });

  it("is quiet when the idempotent processor has no work", async () => {
    const onFinished = vi.fn();
    await processReconciliationReplays({ processReconciliationReplayEvents: async () => [] }, onFinished);
    expect(onFinished).not.toHaveBeenCalled();
  });
});
