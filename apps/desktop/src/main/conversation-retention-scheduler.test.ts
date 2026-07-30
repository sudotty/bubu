import { describe, expect, it, vi } from "vitest";
import { startConversationRetentionScheduler } from "./conversation-retention-scheduler.js";

describe("conversation retention scheduler", () => {
  it("does nothing while disabled and applies the exact enabled policy", async () => {
    vi.useFakeTimers();
    let enabled = false;
    const apply = vi.fn(async () => ({ schemaVersion: 1 as const, deletedThreadCount: 0, deletedEntryCount: 0, appliedAt: "2026-07-29T00:00:00Z" }));
    const stop = startConversationRetentionScheduler({ store: { state: () => ({ schemaVersion: 1, enabled, retentionDays: 120 }), save: vi.fn() }, apply, intervalMilliseconds: 100 });
    await vi.advanceTimersByTimeAsync(100);
    expect(apply).not.toHaveBeenCalled();
    enabled = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(apply).toHaveBeenCalledWith(120);
    stop();
    await vi.advanceTimersByTimeAsync(200);
    expect(apply).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("continues bounded batches until the eligible backlog is drained", async () => {
    vi.useFakeTimers();
    const apply = vi.fn()
      .mockResolvedValueOnce({ schemaVersion: 1 as const, deletedThreadCount: 1_000, deletedEntryCount: 2_000, appliedAt: "2026-07-29T00:00:00Z" })
      .mockResolvedValueOnce({ schemaVersion: 1 as const, deletedThreadCount: 1_000, deletedEntryCount: 2_000, appliedAt: "2026-07-29T00:00:01Z" })
      .mockResolvedValueOnce({ schemaVersion: 1 as const, deletedThreadCount: 7, deletedEntryCount: 14, appliedAt: "2026-07-29T00:00:02Z" });
    const stop = startConversationRetentionScheduler({ store: { state: () => ({ schemaVersion: 1, enabled: true, retentionDays: 90 }), save: vi.fn() }, apply, intervalMilliseconds: 1_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(apply).toHaveBeenCalledTimes(3);
    stop();
    vi.useRealTimers();
  });
});
