import { z } from "zod";

export const datasetIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);
export const columnTypeSchema = z.enum(["null", "boolean", "integer", "real", "datetime", "text"]);

export const datasetSummarySchema = z
  .object({
    id: datasetIdSchema,
    versionId: datasetIdSchema,
    displayName: z.string().min(1).max(500),
    sourceKind: z.enum(["csv", "xlsx", "derived"]),
    sourceName: z.string().min(1).max(500),
    rowCount: z.number().int().nonnegative(),
    columnCount: z.number().int().positive(),
    importedAt: z.string().datetime({ offset: true }),
    version: z.number().int().positive(),
  })
  .strict();

export const columnProfileSchema = z
  .object({
    ordinal: z.number().int().nonnegative(),
    sourceName: z.string(),
    name: z.string().min(1),
    inferredType: columnTypeSchema,
    nullable: z.boolean(),
    nullCount: z.number().int().nonnegative(),
    distinctCount: z.number().int().nonnegative(),
    minValue: z.string().nullable(),
    maxValue: z.string().nullable(),
  })
  .strict();

export const datasetImportResultSchema = z
  .object({ datasets: z.array(datasetSummarySchema) })
  .strict();

export const datasetPreviewRequestSchema = z
  .object({
    datasetId: datasetIdSchema,
    limit: z.number().int().min(1).max(500).default(50),
    offset: z.number().int().nonnegative().default(0),
  })
  .strict();

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const datasetPreviewSchema = z
  .object({
    datasetId: datasetIdSchema,
    versionId: datasetIdSchema,
    columns: z.array(columnProfileSchema).min(1),
    rows: z.array(z.array(cellValueSchema)),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(500),
    totalRows: z.number().int().nonnegative(),
  })
  .strict();

export const datasetListSchema = z.array(datasetSummarySchema);

export const schemaDriftSchema = z
  .object({
    currentColumns: z.array(z.string().min(1)).min(1),
    incomingColumns: z.array(z.string().min(1)).min(1),
    missingColumns: z.array(z.string().min(1)),
    addedColumns: z.array(z.string().min(1)),
    reordered: z.boolean(),
  })
  .strict();

export const datasetReplacementResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("replaced"), dataset: datasetSummarySchema }).strict(),
  z.object({ status: z.literal("mapping-required"), drift: schemaDriftSchema }).strict(),
]);

export type DatasetSummary = z.infer<typeof datasetSummarySchema>;
export type ColumnProfile = z.infer<typeof columnProfileSchema>;
export type DatasetImportResult = z.infer<typeof datasetImportResultSchema>;
export type DatasetPreviewRequest = z.infer<typeof datasetPreviewRequestSchema>;
export type DatasetPreview = z.infer<typeof datasetPreviewSchema>;
export type SchemaDrift = z.infer<typeof schemaDriftSchema>;
export type DatasetReplacementResult = z.infer<typeof datasetReplacementResultSchema>;

export function parseDatasetId(value: unknown): string {
  return datasetIdSchema.parse(value);
}

export function parseDatasetSummary(value: unknown): DatasetSummary {
  return datasetSummarySchema.parse(value);
}

export function parseDatasetImportResult(value: unknown): DatasetImportResult {
  return datasetImportResultSchema.parse(value);
}

export function parseDatasetList(value: unknown): readonly DatasetSummary[] {
  return datasetListSchema.parse(value);
}

export function parseDatasetPreviewRequest(value: unknown): DatasetPreviewRequest {
  return datasetPreviewRequestSchema.parse(value);
}

export function parseDatasetPreview(value: unknown): DatasetPreview {
  return datasetPreviewSchema.parse(value);
}

export function parseDatasetReplacementResult(value: unknown): DatasetReplacementResult {
  return datasetReplacementResultSchema.parse(value);
}
