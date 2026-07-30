import { afterEach, describe, expect, it, vi } from "vitest";
import { startNonOverlappingScheduler } from "./non-overlapping-scheduler.js";

afterEach(() => vi.useRealTimers());

describe("non-overlapping scheduler", () => {
  it("runs immediately, never overlaps, and stops future ticks", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const task = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const stop = startNonOverlappingScheduler({ intervalMilliseconds: 10, task });
    await vi.advanceTimersByTimeAsync(30);
    expect(task).toHaveBeenCalledTimes(1);
    finish?.(); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10);
    expect(task).toHaveBeenCalledTimes(2);
    stop(); finish?.(); await vi.advanceTimersByTimeAsync(30);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("checks domain availability and reports failures", async () => {
    vi.useFakeTimers();
    let enabled = false;
    const onError = vi.fn();
    const task = vi.fn(async () => { throw new Error("failed"); });
    startNonOverlappingScheduler({ intervalMilliseconds: 10, task, canRun: () => enabled, onError });
    await vi.advanceTimersByTimeAsync(10); expect(task).not.toHaveBeenCalled();
    enabled = true; await vi.advanceTimersByTimeAsync(10);
    expect(onError).toHaveBeenCalledOnce();
  });
});
