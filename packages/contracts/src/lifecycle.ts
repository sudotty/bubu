import { z } from "zod";
import { datasetGroupIdSchema } from "./dataset-group.js";
import { datasetIdSchema } from "./dataset.js";

const safeFileNameSchema = z.string().min(1).max(500).refine(
  (value) => !value.includes("/") && !value.includes("\\"),
  "Only a file name may cross into the renderer",
);

export const datasetExportResultSchema = z
  .object({
    status: z.literal("exported"),
    datasetId: datasetIdSchema,
    versionId: datasetIdSchema,
    fileName: safeFileNameSchema,
    rowCount: z.number().int().nonnegative(),
    mode: z.literal("excel-safe"),
  })
  .strict();

export const datasetExportSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }).strict(),
  datasetExportResultSchema,
]);

export const datasetDeletionResultSchema = z
  .object({
    status: z.literal("deleted"),
    datasetId: datasetIdSchema,
    removedGroupIds: z.array(datasetGroupIdSchema).max(100),
    updatedGroupIds: z.array(datasetGroupIdSchema).max(100),
  })
  .strict();

export const datasetDeletionSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }).strict(),
  datasetDeletionResultSchema,
]);

export type DatasetExportResult = z.infer<typeof datasetExportResultSchema>;
export type DatasetExportSelectionResult = z.infer<typeof datasetExportSelectionResultSchema>;
export type DatasetDeletionResult = z.infer<typeof datasetDeletionResultSchema>;
export type DatasetDeletionSelectionResult = z.infer<typeof datasetDeletionSelectionResultSchema>;

export function parseDatasetExportResult(value: unknown): DatasetExportResult {
  return datasetExportResultSchema.parse(value);
}

export function parseDatasetDeletionResult(value: unknown): DatasetDeletionResult {
  return datasetDeletionResultSchema.parse(value);
}
