import { describe, expect, it } from "vitest";
import { parseConversationAppendInput, parseConversationDeleteInput, parseConversationEntryPage, parseConversationEntryPageRequest, parseConversationRetentionPolicy, parseConversationThread } from "./conversation.js";
import { aggregateAgentBudget } from "./aggregate-agent.js";

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
    const agentRun = {
      schemaVersion: 1 as const,
      id: "f".repeat(32),
      disclosure,
      budget: aggregateAgentBudget,
      startedAt: "2026-07-17T00:00:00Z",
      finishedAt: "2026-07-17T00:00:01Z",
      turns: [{ turn: 1, auditId: "1".repeat(32), action: "finish" as const }],
      report: {
        schemaVersion: 1 as const,
        summary: explanation.summary,
        findings: explanation.findings,
        caveats: explanation.caveats,
        nextQuestions: explanation.nextQuestions,
      },
    };
    expect(parseConversationAppendInput({
      target,
      entry: { kind: "insight", role: "assistant", payload: { agentRun } },
    })).toMatchObject({ entry: { payload: { agentRun: { id: agentRun.id } } } });
    const automation = { eventId: "2".repeat(32), targetDatasetId: target.id, targetDisplayName: "规范订单", sourceVersionId: "3".repeat(32), resultVersionId: "4".repeat(32), status: "succeeded" as const, reasonKind: null, message: "已创建不可变新版本。" };
    expect(parseConversationAppendInput({ target, entry: { kind: "insight", role: "assistant", payload: { automation } } })).toMatchObject({ entry: { payload: { automation: { status: "succeeded" } } } });
    expect(() => parseConversationAppendInput({ target, entry: { kind: "insight", role: "assistant", payload: { automation: { ...automation, rows: [["private"]] } } } })).toThrow();
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

  it("binds permanent deletion to an archived thread snapshot and bounds retention", () => {
    expect(parseConversationDeleteInput({
      threadId: "b".repeat(32),
      expectedTitle: "已归档任务",
      expectedUpdatedAt: "2026-07-29T00:00:00Z",
    })).toMatchObject({ expectedTitle: "已归档任务" });
    expect(() => parseConversationDeleteInput({ threadId: "b".repeat(32), expectedTitle: "", expectedUpdatedAt: "yesterday" })).toThrow();
    expect(parseConversationRetentionPolicy({ schemaVersion: 1, enabled: true, retentionDays: 90 })).toMatchObject({ retentionDays: 90 });
    expect(() => parseConversationRetentionPolicy({ schemaVersion: 1, enabled: true, retentionDays: 7 })).toThrow();
    expect(() => parseConversationRetentionPolicy({ schemaVersion: 1, enabled: false, retentionDays: 10_000 })).toThrow();
  });

  it("bounds older-entry pages and keeps the continuation cursor explicit", () => {
    const threadId = "b".repeat(32);
    const entry = {
      id: "c".repeat(32), threadId, ordinal: 400, kind: "question", role: "user",
      payload: { question: "更早的问题" }, createdAt: "2026-07-17T00:00:00Z",
    } as const;
    expect(parseConversationEntryPageRequest({ threadId, beforeOrdinal: 501 })).toMatchObject({ limit: 100 });
    expect(parseConversationEntryPage({ threadId, entries: [entry], nextBeforeOrdinal: 400, totalEntries: 620 })).toMatchObject({ totalEntries: 620 });
    expect(() => parseConversationEntryPageRequest({ threadId, beforeOrdinal: 501, limit: 101 })).toThrow();
    expect(() => parseConversationEntryPage({ threadId, entries: [], nextBeforeOrdinal: null, totalEntries: 10_001 })).toThrow();
  });
});
