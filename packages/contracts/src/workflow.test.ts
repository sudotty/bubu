import { describe, expect, it } from "vitest";
import { parseWorkflowDefinitionInput, parseWorkflowRun } from "./workflow.js";

const datasetId = "a".repeat(32);
const versionId = "b".repeat(32);
const plan = {
  schemaVersion: 1,
  datasetId,
  versionId,
  purpose: "Regional totals",
  dimensions: ["Region"],
  measures: [{ operation: "sum" as const, column: "Amount" }],
  filters: [],
  sort: [],
  limit: 50,
};

describe("workflow contracts", () => {
  it("accepts a bounded manual workflow and rejects target drift", () => {
    const input = {
      name: "Weekly regional totals",
      target: { kind: "dataset" as const, id: datasetId },
      threadId: "e".repeat(32),
      trigger: { kind: "manual" as const },
      timeoutMs: 60_000,
      steps: [{ id: "regional-totals", kind: "dataset-query" as const, plan, maxAttempts: 2 }],
    };
    expect(parseWorkflowDefinitionInput(input)).toEqual(input);
    expect(() => parseWorkflowDefinitionInput({
      ...input,
      threadId: undefined,
    })).toThrow();
    expect(() => parseWorkflowDefinitionInput({
      ...input,
      target: { kind: "dataset", id: "c".repeat(32) },
    })).toThrow("target");
    expect(parseWorkflowDefinitionInput({
      ...input,
      trigger: { kind: "interval", everyMinutes: 24 * 60 },
    }).trigger).toEqual({ kind: "interval", everyMinutes: 24 * 60 });
  });

  it("parses typed checkpoint results without accepting arbitrary artifacts", () => {
    const run = {
      id: "c".repeat(32),
      workflowId: "d".repeat(32),
      definitionVersion: 1,
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      status: "succeeded",
      startedAt: "2026-07-17T00:00:00Z",
      finishedAt: "2026-07-17T00:00:01Z",
      error: null,
      steps: [{
        id: "e".repeat(32),
        stepId: "regional-totals",
        ordinal: 0,
        kind: "dataset-query",
        status: "succeeded",
        attempt: 1,
        startedAt: "2026-07-17T00:00:00Z",
        finishedAt: "2026-07-17T00:00:01Z",
        error: null,
        result: {
          kind: "dataset-query",
          value: {
            datasetId,
            versionId,
            columns: [{ label: "Region", type: "text" }, { label: "Sum of Amount", type: "real" }],
            rows: [["North", 42]],
            truncated: false,
          },
        },
      }],
    };
    expect(parseWorkflowRun(run)).toEqual(run);
    expect(() => parseWorkflowRun({
      ...run,
      steps: [{ ...run.steps[0], result: { kind: "shell", value: { command: "rm" } } }],
    })).toThrow();
  });
});
