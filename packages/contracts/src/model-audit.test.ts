import { describe, expect, it } from "vitest";
import { parseModelAuditEvent, parseModelAuditStartInput } from "./model-audit.js";

const start = {
  purpose: "query-plan" as const,
  target: { kind: "dataset" as const, id: "a".repeat(32) },
  disclosure: "schema-synthetic" as const,
  providerId: "b".repeat(32),
  providerKind: "openai" as const,
  providerName: "Production model",
  model: "gpt-example",
  endpointOrigin: "https://api.example.com",
  datasetCount: 1,
  columnCount: 8,
  syntheticRowCount: 3,
  aggregateRowCount: 0,
  rawRowCount: 0,
  retrievedChunkCount: 0,
  relationshipCount: 0,
  payloadBytes: 2_048,
  estimatedInputTokens: 683,
  maxOutputTokens: 4_096,
  payloadSha256: "c".repeat(64),
  containsRawRows: false as const,
};

describe("model disclosure audit contracts", () => {
  it("accepts a data-free bounded disclosure summary", () => {
    expect(parseModelAuditStartInput(start)).toEqual(start);
  });

  it("rejects false disclosure counts and raw-row claims", () => {
    expect(() => parseModelAuditStartInput({ ...start, syntheticRowCount: 2 })).toThrow("Synthetic");
    expect(() => parseModelAuditStartInput({ ...start, containsRawRows: true })).toThrow();
  });

  it("accepts raw rows only for an exact explicit-row explanation scope", () => {
    expect(parseModelAuditStartInput({
      ...start,
      purpose: "explicit-row-explanation",
      disclosure: "explicit-rows",
      syntheticRowCount: 0,
      rawRowCount: 2,
      columnCount: 2,
      containsRawRows: true,
    })).toMatchObject({ purpose: "explicit-row-explanation", disclosure: "explicit-rows", rawRowCount: 2, containsRawRows: true });
    expect(() => parseModelAuditStartInput({ ...start, disclosure: "explicit-rows", rawRowCount: 2, containsRawRows: true })).toThrow("Explicit");
    expect(() => parseModelAuditStartInput({ ...start, purpose: "explicit-row-explanation", disclosure: "explicit-rows", syntheticRowCount: 0, rawRowCount: 0, containsRawRows: true })).toThrow("Explicit");
  });

  it("accepts a bounded aggregate explanation scope without synthetic or raw rows", () => {
    expect(parseModelAuditStartInput({
      ...start,
      purpose: "aggregate-explanation",
      disclosure: "aggregates",
      syntheticRowCount: 0,
      aggregateRowCount: 2,
      columnCount: 3,
    })).toMatchObject({
      purpose: "aggregate-explanation",
      disclosure: "aggregates",
      aggregateRowCount: 2,
      containsRawRows: false,
    });
    expect(() => parseModelAuditStartInput({
      ...start,
      purpose: "aggregate-explanation",
      disclosure: "aggregates",
      syntheticRowCount: 0,
      aggregateRowCount: 0,
    })).toThrow("Aggregate");
    expect(parseModelAuditStartInput({
      ...start,
      purpose: "aggregate-agent",
      disclosure: "aggregates",
      syntheticRowCount: 0,
      aggregateRowCount: 2,
      columnCount: 3,
      maxOutputTokens: 2_048,
    })).toMatchObject({ purpose: "aggregate-agent", disclosure: "aggregates" });
  });

  it("accepts retrieved chunks only for an exact local knowledge answer scope", () => {
    expect(parseModelAuditStartInput({
      ...start,
      purpose: "knowledge-answer",
      target: { kind: "knowledge-source", id: "d".repeat(32) },
      disclosure: "retrieved-chunks",
      datasetCount: 0,
      columnCount: 0,
      syntheticRowCount: 0,
      retrievedChunkCount: 2,
    })).toMatchObject({ purpose: "knowledge-answer", disclosure: "retrieved-chunks", retrievedChunkCount: 2 });
    expect(() => parseModelAuditStartInput({ ...start, disclosure: "retrieved-chunks", retrievedChunkCount: 2 })).toThrow("knowledge");
  });

  it("separates MCP prompt content and tool schemas into exact model purposes", () => {
    for (const [purpose, disclosure] of [["mcp-prompt-response", "mcp-prompt-content"], ["mcp-tool-proposal", "mcp-tool-schemas"]] as const) {
      expect(parseModelAuditStartInput({ ...start, purpose, target: { kind: "mcp-connection", id: "d".repeat(32) }, disclosure, datasetCount: 0, columnCount: 0, syntheticRowCount: 0 })).toMatchObject({ purpose, disclosure });
    }
    expect(() => parseModelAuditStartInput({ ...start, disclosure: "mcp-prompt-content" })).toThrow("MCP");
  });

  it("requires terminal audit consistency", () => {
    expect(() => parseModelAuditEvent({
      ...start,
      id: "d".repeat(32),
      status: "succeeded",
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      outputBytes: 80,
      error: "must not exist",
      startedAt: "2026-07-17T00:00:00Z",
      finishedAt: "2026-07-17T00:00:01Z",
    })).toThrow("Successful");
  });
});
