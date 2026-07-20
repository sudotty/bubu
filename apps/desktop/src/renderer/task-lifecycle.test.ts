import { describe, expect, it } from "vitest";
import type { ConversationEntry } from "../shared/product-api.js";
import { derivePersistedTaskState, isCancellation } from "./task-lifecycle.js";

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

describe("isCancellation", () => {
  it("recognizes structured aborts and localized cancellation messages", () => {
    expect(isCancellation(Object.assign(new Error("stopped"), { name: "AbortError" }))).toBe(true);
    expect(isCancellation(new Error("操作已取消"))).toBe(true);
    expect(isCancellation(new Error("network failed"))).toBe(false);
  });
});
