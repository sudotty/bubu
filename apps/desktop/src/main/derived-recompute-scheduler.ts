import type { DerivedRecomputeEvent } from "@bubu/contracts";
import { AUTOMATION_POLL_INTERVAL_MILLISECONDS } from "../shared/automation.js";
import { startNonOverlappingScheduler } from "./non-overlapping-scheduler.js";

export interface DerivedRecomputeRuntime {
  processDerivedRecomputeEvents(): Promise<readonly DerivedRecomputeEvent[]>;
}

export async function processDerivedRecomputes(
  runtime: DerivedRecomputeRuntime,
  onFinished: (event: DerivedRecomputeEvent) => void = () => undefined,
): Promise<readonly DerivedRecomputeEvent[]> {
  const events = await runtime.processDerivedRecomputeEvents();
  for (const event of events) onFinished(event);
  return events;
}

export function startDerivedRecomputeScheduler(
  runtime: DerivedRecomputeRuntime,
  options: {
    readonly intervalMilliseconds?: number;
    readonly onError?: (error: unknown) => void;
    readonly onFinished?: (event: DerivedRecomputeEvent) => void;
  } = {},
): () => void {
  return startNonOverlappingScheduler({ intervalMilliseconds: options.intervalMilliseconds ?? AUTOMATION_POLL_INTERVAL_MILLISECONDS, task: () => processDerivedRecomputes(runtime, options.onFinished), onError: options.onError });
}
