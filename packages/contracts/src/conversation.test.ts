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

  it("links results to reviewed plans and persists only typed aggregate insights", () => {
    const plan = {
      schemaVersion: 1 as const,
      datasetId: target.id,
      versionId: "d".repeat(32),
      purpose: "Count by region",
      dimensions: ["Region"],
      measures: [{ operation: "count" as const, column: null }],
      filters: [], sort: [], limit: 50,
    };
    const result = {
      datasetId: target.id,
      versionId: plan.versionId,
      columns: [{ label: "Region", type: "text" as const }, { label: "count(*)", type: "integer" as const }],
      rows: [["North", 8]],
      truncated: false,
    };
    expect(parseConversationAppendInput({
      target,
      entry: { kind: "result", role: "assistant", payload: { result, sourcePlan: plan } },
    })).toMatchObject({ entry: { payload: { sourcePlan: plan } } });
    expect(() => parseConversationAppendInput({
      target,
      entry: {
        kind: "result",
        role: "assistant",
        payload: { result, sourcePlan: { ...plan, versionId: "e".repeat(32) } },
      },
    })).toThrow("same immutable source");
    const disclosure = {
      schemaVersion: 1 as const,
      target,
      question: "Explain",
      purpose: plan.purpose,
      sourceCount: 1,
      columns: result.columns,
      rows: result.rows,
      truncated: false,
      minimumGroupSize: 5 as const,
    };
    const explanation = {
      schemaVersion: 1 as const,
      disclosure,
      summary: "North has eight records.",
      findings: [{
        title: "Eight records", detail: "The approved count is eight.",
        evidence: [{ rowIndex: 0, columnIndex: 1 }],
      }],
      caveats: [], nextQuestions: [],
    };
    expect(parseConversationAppendInput({
      target,
      entry: { kind: "insight", role: "assistant", payload: { explanation } },
    })).toMatchObject({ entry: { kind: "insight" } });
    expect(() => parseConversationAppendInput({
      target,
      entry: { kind: "insight", role: "system", payload: { explanation } },
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
