import type { OperationId } from "../shared/product-api.js";

export function createOperationId(): OperationId {
  return crypto.randomUUID();
}

export function operationErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return /abort|cancel(?:led|ed)?|已取消|取消/u.test(message)
    ? "操作已取消"
    : message;
}
