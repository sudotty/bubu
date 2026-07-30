import type { ReconciliationReplayEvent } from "@bubu/contracts";
import { AUTOMATION_POLL_INTERVAL_MILLISECONDS } from "../shared/automation.js";
import { startNonOverlappingScheduler } from "./non-overlapping-scheduler.js";

export interface ReconciliationReplayRuntime {
  processReconciliationReplayEvents(): Promise<readonly ReconciliationReplayEvent[]>;
}

export async function processReconciliationReplays(
  runtime: ReconciliationReplayRuntime,
  onFinished: (event: ReconciliationReplayEvent) => void = () => undefined,
): Promise<readonly ReconciliationReplayEvent[]> {
  const events = await runtime.processReconciliationReplayEvents();
  for (const event of events) onFinished(event);
  return events;
}

export function startReconciliationReplayScheduler(
  runtime: ReconciliationReplayRuntime,
  options: {
    readonly intervalMilliseconds?: number;
    readonly onError?: (error: unknown) => void;
    readonly onFinished?: (event: ReconciliationReplayEvent) => void;
  } = {},
): () => void {
  return startNonOverlappingScheduler({ intervalMilliseconds: options.intervalMilliseconds ?? AUTOMATION_POLL_INTERVAL_MILLISECONDS, task: () => processReconciliationReplays(runtime, options.onFinished), onError: options.onError });
}
