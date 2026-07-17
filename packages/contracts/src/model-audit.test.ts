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
