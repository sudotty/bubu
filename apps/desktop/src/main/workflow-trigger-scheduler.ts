import type {
  WorkflowRun,
  WorkflowTriggerEvent,
  WorkflowTriggerFinishInput,
} from "@bubu/contracts";
import { AUTOMATION_POLL_INTERVAL_MILLISECONDS } from "../shared/automation.js";

export interface WorkflowTriggerRuntime {
  claimDueWorkflowTriggers(now: string): Promise<readonly WorkflowTriggerEvent[]>;
  runWorkflow(workflowId: string, idempotencyKey: string): Promise<WorkflowRun>;
  finishWorkflowTrigger(input: WorkflowTriggerFinishInput): Promise<WorkflowTriggerEvent>;
}

export async function processDueWorkflowTriggers(
  runtime: WorkflowTriggerRuntime,
  now: Date,
  onFinished: (event: WorkflowTriggerEvent) => void = () => undefined,
): Promise<void> {
  const events = await runtime.claimDueWorkflowTriggers(now.toISOString());
  for (const event of events) {
    let run: WorkflowRun;
    try {
      run = await runtime.runWorkflow(event.workflowId, event.operationId);
    } catch {
      continue;
    }
    const error = run.error ?? (run.status === "succeeded" ? null : "工作流触发运行没有返回错误说明");
    const finished = await runtime.finishWorkflowTrigger({
      id: event.id,
      status: run.status === "running" ? "failed" : run.status,
      runId: run.id,
      error: run.status === "succeeded" ? null : error,
    });
    onFinished(finished);
  }
}

export function startWorkflowTriggerScheduler(
  runtime: WorkflowTriggerRuntime,
  options: {
    readonly now?: () => Date;
    readonly intervalMilliseconds?: number;
    readonly onError?: (error: unknown) => void;
    readonly onFinished?: (event: WorkflowTriggerEvent) => void;
  } = {},
): () => void {
  const now = options.now ?? (() => new Date());
  const onError = options.onError ?? (() => undefined);
  let active = true;
  let running = false;
  const tick = async () => {
    if (!active || running) return;
    running = true;
    try {
      await processDueWorkflowTriggers(runtime, now(), options.onFinished);
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => {
    void tick();
  }, options.intervalMilliseconds ?? AUTOMATION_POLL_INTERVAL_MILLISECONDS);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
