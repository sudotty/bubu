import type { ConversationRetentionResult } from "@bubu/contracts";
import type { ConversationRetentionStore } from "./conversation-retention-store.js";
import { startNonOverlappingScheduler } from "./non-overlapping-scheduler.js";

const defaultIntervalMilliseconds = 6 * 60 * 60 * 1_000;
const deletionBatchSize = 1_000;
const maximumBatchesPerTick = 100;

export function startConversationRetentionScheduler(options: {
  readonly store: ConversationRetentionStore;
  readonly apply: (retentionDays: number) => Promise<ConversationRetentionResult>;
  readonly intervalMilliseconds?: number;
  readonly onError?: (error: unknown) => void;
}): () => void {
  return startNonOverlappingScheduler({
    intervalMilliseconds: options.intervalMilliseconds ?? defaultIntervalMilliseconds,
    canRun: () => options.store.state().enabled,
    task: async () => {
    const policy = options.store.state();
    for (let batch = 0; batch < maximumBatchesPerTick; batch += 1) {
      const result = await options.apply(policy.retentionDays);
      if (result.deletedThreadCount < deletionBatchSize) break;
      await Promise.resolve();
    }
    },
    onError: options.onError,
    unref: true,
  });
}
