import { z } from "zod";

export const operationIdSchema = z.string().uuid();
export const operationStartSchema = z.object({ operationId: operationIdSchema }).strict();
export const operationEnvelopeSchema = z.object({
  operationId: operationIdSchema,
  value: z.unknown(),
}).strict();
export const operationCancellationResultSchema = z.object({
  operationId: operationIdSchema,
  cancelled: z.boolean(),
}).strict();

export type OperationId = z.infer<typeof operationIdSchema>;
export type OperationStart = z.infer<typeof operationStartSchema>;
export type OperationEnvelope = z.infer<typeof operationEnvelopeSchema>;
export type OperationCancellationResult = z.infer<typeof operationCancellationResultSchema>;

export function parseOperationId(value: unknown): OperationId {
  return operationIdSchema.parse(value);
}

export function parseOperationStart(value: unknown): OperationStart {
  return operationStartSchema.parse(value);
}

export function parseOperationEnvelope(value: unknown): OperationEnvelope {
  return operationEnvelopeSchema.parse(value);
}
