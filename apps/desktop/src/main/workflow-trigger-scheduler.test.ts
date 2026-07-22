import { describe, expect, it, vi } from "vitest";
import type { WorkflowRun, WorkflowTriggerEvent } from "@bubu/contracts";
import { processDueWorkflowTriggers, type WorkflowTriggerRuntime } from "./workflow-trigger-scheduler.js";

const target = { kind: "dataset" as const, id: "a".repeat(32) };
const event: WorkflowTriggerEvent = {
  id: "b".repeat(32),
  workflowId: "c".repeat(32),
  definitionVersion: 1,
  operationId: "123e4567-e89b-42d3-a456-426614174020",
  target,
  triggerKind: "dataset-version",
  dueAt: "2026-07-17T00:00:00Z",
  status: "pending",
  runId: null,
  error: null,
  createdAt: "2026-07-17T00:00:00Z",
  finishedAt: null,
};

const run: WorkflowRun = {
  id: "d".repeat(32),
  workflowId: event.workflowId,
  definitionVersion: 1,
  idempotencyKey: event.operationId,
  status: "succeeded",
  startedAt: "2026-07-17T00:00:00Z",
  finishedAt: "2026-07-17T00:00:01Z",
  error: null,
  steps: [],
};

describe("workflow trigger scheduler", () => {
  it("reuses the persisted operation identity and finishes a terminal run", async () => {
    const finish = vi.fn(async () => ({ ...event, status: "succeeded" as const }));
    const runtime: WorkflowTriggerRuntime = {
      claimDueWorkflowTriggers: async () => [event],
      runWorkflow: async (workflowId, operationId) => {
        expect([workflowId, operationId]).toEqual([event.workflowId, event.operationId]);
        return run;
      },
      finishWorkflowTrigger: finish,
    };
    await processDueWorkflowTriggers(runtime, new Date("2026-07-17T00:00:00Z"));
    expect(finish).toHaveBeenCalledWith({ id: event.id, status: "succeeded", runId: run.id, error: null });
  });

  it("leaves a transiently unreachable run pending for the next tick", async () => {
    const finish = vi.fn();
    const runtime: WorkflowTriggerRuntime = {
      claimDueWorkflowTriggers: async () => [event],
      runWorkflow: async () => { throw new Error("sidecar restarting"); },
      finishWorkflowTrigger: finish,
    };
    await processDueWorkflowTriggers(runtime, new Date("2026-07-17T00:00:00Z"));
    expect(finish).not.toHaveBeenCalled();
  });

  it("notifies only after the persisted event reaches a terminal state", async () => {
    const finished = { ...event, status: "succeeded" as const, runId: run.id, finishedAt: run.finishedAt };
    const onFinished = vi.fn();
    const runtime: WorkflowTriggerRuntime = {
      claimDueWorkflowTriggers: async () => [event],
      runWorkflow: async () => run,
      finishWorkflowTrigger: async () => finished,
    };
    await processDueWorkflowTriggers(runtime, new Date("2026-07-17T00:00:00Z"), onFinished);
    expect(onFinished).toHaveBeenCalledWith(finished);
  });
});
