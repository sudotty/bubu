import { z } from "zod";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";

const columnNameSchema = z.string().min(1).max(500);
const distributionBase = {
  localOnly: z.literal(true),
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
  column: columnNameSchema,
  inferredType: columnTypeSchema,
  nonNullCount: z.number().int().nonnegative(),
} as const;

export const columnDistributionRequestSchema = z.object({
  datasetId: datasetIdSchema,
  column: columnNameSchema,
}).strict();

const histogramBinSchema = z.object({
  minimum: z.number().finite(),
  maximum: z.number().finite(),
  count: z.number().int().nonnegative(),
  rate: z.number().min(0).max(1),
}).strict();

const frequentValueSchema = z.object({
  preview: z.string().max(120),
  truncated: z.boolean(),
  count: z.number().int().positive(),
  rate: z.number().min(0).max(1),
}).strict();

export const columnDistributionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("empty"), ...distributionBase }).strict(),
  z.object({
    kind: z.literal("numeric"),
    ...distributionBase,
    minimum: z.number().finite(),
    maximum: z.number().finite(),
    mean: z.number().finite(),
    bins: z.array(histogramBinSchema).min(1).max(12),
  }).strict(),
  z.object({
    kind: z.literal("categorical"),
    ...distributionBase,
    values: z.array(frequentValueSchema).max(10),
    otherCount: z.number().int().nonnegative(),
  }).strict(),
]);

export type ColumnDistributionRequest = z.infer<typeof columnDistributionRequestSchema>;
export type ColumnDistribution = z.infer<typeof columnDistributionSchema>;

export function parseColumnDistributionRequest(value: unknown): ColumnDistributionRequest {
  return columnDistributionRequestSchema.parse(value);
}

export function parseColumnDistribution(value: unknown): ColumnDistribution {
  return columnDistributionSchema.parse(value);
}
