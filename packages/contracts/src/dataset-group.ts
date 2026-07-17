import { z } from "zod";
import { datasetIdSchema, datasetSummarySchema } from "./dataset.js";

export const datasetGroupIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);

export const datasetGroupSchema = z
  .object({
    id: datasetGroupIdSchema,
    name: z.string().trim().min(1).max(100),
    members: z.array(datasetSummarySchema).min(2).max(8),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const datasetGroupListSchema = z.array(datasetGroupSchema);
export const datasetGroupDeletionResultSchema = z.object({ deleted: z.literal(true) }).strict();

export const datasetGroupSaveInputSchema = z
  .object({
    id: datasetGroupIdSchema.optional(),
    name: z.string().trim().min(1).max(100),
    datasetIds: z.array(datasetIdSchema).min(2).max(8),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.datasetIds).size !== input.datasetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["datasetIds"],
        message: "Group dataset contacts must be unique",
      });
    }
  });

export type DatasetGroupId = z.infer<typeof datasetGroupIdSchema>;
export type DatasetGroup = z.infer<typeof datasetGroupSchema>;
export type DatasetGroupSaveInput = z.infer<typeof datasetGroupSaveInputSchema>;

export function parseDatasetGroupId(value: unknown): DatasetGroupId {
  return datasetGroupIdSchema.parse(value);
}

export function parseDatasetGroup(value: unknown): DatasetGroup {
  return datasetGroupSchema.parse(value);
}

export function parseDatasetGroupList(value: unknown): readonly DatasetGroup[] {
  return datasetGroupListSchema.parse(value);
}

export function parseDatasetGroupSaveInput(value: unknown): DatasetGroupSaveInput {
  return datasetGroupSaveInputSchema.parse(value);
}

export function parseDatasetGroupDeletionResult(value: unknown): { readonly deleted: true } {
  return datasetGroupDeletionResultSchema.parse(value);
}
