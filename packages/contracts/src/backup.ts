import { z } from "zod";

const safeBackupFileNameSchema = z.string().min(1).max(500).refine(
  (value) => !value.includes("/") && !value.includes("\\"),
  "Only a backup file name may cross into the renderer",
);

const backupSummaryFields = {
  fileName: safeBackupFileNameSchema,
  backupCreatedAt: z.string().datetime({ offset: true }),
  databaseBytes: z.number().int().nonnegative(),
  datasetCount: z.number().int().nonnegative(),
  groupCount: z.number().int().nonnegative(),
} as const;

export const dataBackupResultSchema = z.object({
  status: z.literal("created"),
  ...backupSummaryFields,
}).strict();

export const dataBackupSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }).strict(),
  dataBackupResultSchema,
]);

export const dataRestoreResultSchema = z.object({
  status: z.literal("restored"),
  ...backupSummaryFields,
}).strict();

export const dataRestoreSelectionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("cancelled") }).strict(),
  dataRestoreResultSchema,
]);

export type DataBackupResult = z.infer<typeof dataBackupResultSchema>;
export type DataBackupSelectionResult = z.infer<typeof dataBackupSelectionResultSchema>;
export type DataRestoreResult = z.infer<typeof dataRestoreResultSchema>;
export type DataRestoreSelectionResult = z.infer<typeof dataRestoreSelectionResultSchema>;

export function parseDataBackupResult(value: unknown): DataBackupResult {
  return dataBackupResultSchema.parse(value);
}

export function parseDataRestoreResult(value: unknown): DataRestoreResult {
  return dataRestoreResultSchema.parse(value);
}
