import type { OperationId } from "@bubu/contracts";

export interface OperationRegistry {
  run<T>(operationId: OperationId, work: (signal: AbortSignal) => Promise<T>): Promise<T>;
  cancel(operationId: OperationId): boolean;
}

export function createOperationRegistry(): OperationRegistry {
  const active = new Map<OperationId, AbortController>();
  return {
    async run(operationId, work) {
      if (active.has(operationId)) throw new Error("Operation is already active");
      const controller = new AbortController();
      active.set(operationId, controller);
      try {
        return await work(controller.signal);
      } finally {
        active.delete(operationId);
      }
    },
    cancel(operationId) {
      const controller = active.get(operationId);
      controller?.abort();
      return controller !== undefined;
    },
  };
}
