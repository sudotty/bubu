import { describe, expect, it } from "vitest";
import type { ConversationEntry } from "../shared/product-api.js";
import { derivePersistedTaskState, isCancellation, latestTaskSnapshot } from "./task-lifecycle.js";

const base = { id: "11111111111111111111111111111111", ordinal: 1, createdAt: "2026-07-20T00:00:00.000Z" } as const;

describe("derivePersistedTaskState", () => {
  it("distinguishes drafts, approvals, results, failures, cancellations, and interrupted questions", () => {
    expect(derivePersistedTaskState([])).toBe("draft");
    expect(derivePersistedTaskState([{ ...base, kind: "plan", role: "assistant", payload: { proposal: {} } } as unknown as ConversationEntry])).toBe("awaiting-approval");
    expect(derivePersistedTaskState([{ ...base, kind: "result", role: "assistant", payload: { result: {} } } as unknown as ConversationEntry])).toBe("completed");
    expect(derivePersistedTaskState([{ ...base, kind: "error", role: "system", payload: { message: "provider failed" } } as ConversationEntry])).toBe("needs-attention");
    expect(derivePersistedTaskState([{ ...base, kind: "error", role: "system", payload: { message: "RPC operation cancelled" } } as ConversationEntry])).toBe("cancelled");
    expect(derivePersistedTaskState([{ ...base, kind: "question", role: "user", payload: { question: "分析" } } as ConversationEntry])).toBe("needs-attention");
  });
});

describe("latestTaskSnapshot", () => {
  it("does not reuse a prior result after a newer question starts", () => {
    const entries = [
      { ...base, kind: "question", role: "user", payload: { question: "上一个问题" } },
      { ...base, id: "22222222222222222222222222222222", ordinal: 2, kind: "plan", role: "assistant", payload: { proposal: { plan: { purpose: "旧计划" } } } },
      { ...base, id: "33333333333333333333333333333333", ordinal: 3, kind: "result", role: "assistant", payload: { result: { rows: [[1]] } } },
      { ...base, id: "44444444444444444444444444444444", ordinal: 4, kind: "question", role: "user", payload: { question: "当前问题" } },
    ] as unknown as readonly ConversationEntry[];

    const snapshot = latestTaskSnapshot(entries);
    expect(snapshot.question?.payload.question).toBe("当前问题");
    expect(snapshot.plan).toBeUndefined();
    expect(snapshot.result).toBeUndefined();
  });

  it("keeps one completed turn together for resume without duplicating older turns", () => {
    const entries = [
      { ...base, kind: "question", role: "user", payload: { question: "分析" } },
      { ...base, id: "22222222222222222222222222222222", ordinal: 2, kind: "plan", role: "assistant", payload: { proposal: { plan: { purpose: "本次计划" } } } },
      { ...base, id: "33333333333333333333333333333333", ordinal: 3, kind: "result", role: "assistant", payload: { result: { rows: [[1]] } } },
    ] as unknown as readonly ConversationEntry[];

    const snapshot = latestTaskSnapshot(entries);
    expect(snapshot.entries).toHaveLength(3);
    expect(snapshot.plan?.ordinal).toBe(2);
    expect(snapshot.result?.ordinal).toBe(3);
  });
});

describe("isCancellation", () => {
  it("recognizes structured aborts and localized cancellation messages", () => {
    expect(isCancellation(Object.assign(new Error("stopped"), { name: "AbortError" }))).toBe(true);
    expect(isCancellation(new Error("操作已取消"))).toBe(true);
    expect(isCancellation(new Error("network failed"))).toBe(false);
  });
});
