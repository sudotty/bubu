import { describe, expect, it } from "vitest";
import type { WorkflowDefinition, WorkflowRun } from "../shared/product-api.js";
import { buildWorkflowGraph, workflowTriggerLabel } from "./workflow-graph.js";

const definition = {
  id: "a".repeat(32),
  name: "每月销售汇总",
  target: { kind: "dataset", id: "b".repeat(32) },
  threadId: "c".repeat(32),
  trigger: { kind: "interval", everyMinutes: 30 * 24 * 60 },
  timeoutMs: 60_000,
  steps: [{ id: "approved-query", kind: "dataset-query" }],
  version: 1,
  createdAt: "2026-07-20T00:00:00Z",
  updatedAt: "2026-07-20T00:00:00Z",
  nextDueAt: "2026-08-19T00:00:00Z",
} as WorkflowDefinition;

describe("workflow graph", () => {
  it("shows the business definition without inventing run state", () => {
    expect(workflowTriggerLabel(definition)).toBe("每月");
    const nodes = buildWorkflowGraph(definition, undefined, "static");
    expect(nodes.map(({ kind }) => kind)).toEqual(["trigger", "data", "delivery", "reminder"]);
    expect(nodes.every(({ status }) => status === "idle")).toBe(true);
  });

  it("maps the latest matching run into dynamic processing and delivery state", () => {
    const run = {
      workflowId: definition.id,
      status: "succeeded",
      steps: [{ stepId: "approved-query", status: "succeeded" }],
    } as WorkflowRun;
    expect(buildWorkflowGraph(definition, run, "dynamic").map(({ status }) => status)).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
      "idle",
    ]);
  });

  it("keeps another workflow run from leaking into the selected definition", () => {
    const run = { workflowId: "d".repeat(32), status: "failed", steps: [] } as unknown as WorkflowRun;
    expect(buildWorkflowGraph(definition, run, "dynamic").every(({ status }) => status === "idle")).toBe(true);
  });
});
