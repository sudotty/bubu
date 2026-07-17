import { describe, expect, it } from "vitest";
import { parseConversationAppendInput, parseConversationThread } from "./conversation.js";

const target = { kind: "dataset", id: "a".repeat(32) } as const;

describe("conversation boundary", () => {
  it("accepts typed append-only questions and rejects arbitrary payloads", () => {
    expect(parseConversationAppendInput({
      target,
      entry: { kind: "question", role: "user", payload: { question: "总金额是多少？" } },
    })).toMatchObject({ target });
    expect(() => parseConversationAppendInput({
      target,
      entry: { kind: "question", role: "assistant", payload: { question: "forged" } },
    })).toThrow();
    expect(() => parseConversationAppendInput({
      target,
      entry: { kind: "html", role: "assistant", payload: { html: "<script />" } },
    })).toThrow();
  });

  it("requires monotonic stored entry metadata and no hidden sync state", () => {
    const thread = {
      id: "b".repeat(32),
      target,
      title: "总金额是多少？",
      entries: [{
        id: "c".repeat(32),
        threadId: "b".repeat(32),
        ordinal: 1,
        kind: "question",
        role: "user",
        payload: { question: "总金额是多少？" },
        createdAt: "2026-07-17T00:00:00Z",
      }],
      createdAt: "2026-07-17T00:00:00Z",
      updatedAt: "2026-07-17T00:00:00Z",
    } as const;
    expect(parseConversationThread(thread)).toMatchObject({ title: "总金额是多少？" });
    expect(() => parseConversationThread({ ...thread, cloudSynced: true })).toThrow();
  });
});
