import { z } from "zod";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";

const columnNameSchema = z.string().min(1).max(500);
export const validationRuleKindSchema = z.enum([
  "required",
  "unique",
  "number-range",
  "pattern",
  "allowed-values",
]);

export const validationRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("required"), column: columnNameSchema }).strict(),
  z.object({ kind: z.literal("unique"), column: columnNameSchema }).strict(),
  z
    .object({
      kind: z.literal("number-range"),
      column: columnNameSchema,
      minimum: z.number().finite().nullable().default(null),
      maximum: z.number().finite().nullable().default(null),
    })
    .strict(),
  z
    .object({
      kind: z.literal("pattern"),
      column: columnNameSchema,
      pattern: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("allowed-values"),
      column: columnNameSchema,
      values: z.array(z.string().max(500)).min(1).max(50),
    })
    .strict(),
]);

export const validationRulesSchema = z.array(validationRuleSchema).max(100).superRefine((rules, context) => {
  for (const [index, rule] of rules.entries()) {
    if (rule.kind === "number-range") {
      if (rule.minimum === null && rule.maximum === null) {
        context.addIssue({ code: "custom", message: "A number range needs at least one bound", path: [index] });
      }
      if (rule.minimum !== null && rule.maximum !== null && rule.minimum > rule.maximum) {
        context.addIssue({ code: "custom", message: "The minimum cannot exceed the maximum", path: [index] });
      }
    }
    if (rule.kind === "allowed-values" && new Set(rule.values).size !== rule.values.length) {
      context.addIssue({ code: "custom", message: "Allowed values must be unique", path: [index, "values"] });
    }
  }
});

export const datasetValidationSaveInputSchema = z
  .object({
    datasetId: datasetIdSchema,
    rules: validationRulesSchema,
  })
  .strict();

export const columnQualitySchema = z
  .object({
    name: columnNameSchema,
    inferredType: columnTypeSchema,
    rowCount: z.number().int().nonnegative(),
    nullCount: z.number().int().nonnegative(),
    nullRate: z.number().min(0).max(1),
    distinctCount: z.number().int().nonnegative(),
    distinctRate: z.number().min(0).max(1),
    minValue: z.string().nullable(),
    maxValue: z.string().nullable(),
  })
  .strict();

export const qualityFindingSchema = z
  .object({
    kind: z.enum(["empty-dataset", "all-null", "high-null-rate", "constant", "candidate-key"]),
    severity: z.enum(["info", "warning", "error"]),
    column: columnNameSchema.nullable(),
  })
  .strict();

export const validationResultSchema = z
  .object({
    ruleIndex: z.number().int().nonnegative(),
    kind: validationRuleKindSchema,
    column: columnNameSchema,
    failedRows: z.number().int().nonnegative(),
    sampleRowNumbers: z.array(z.number().int().positive()).max(20),
  })
  .strict();

export const datasetQualityReportSchema = z
  .object({
    datasetId: datasetIdSchema,
    versionId: datasetIdSchema,
    rowCount: z.number().int().nonnegative(),
    score: z.number().int().min(0).max(100),
    columns: z.array(columnQualitySchema).min(1).max(500),
    findings: z.array(qualityFindingSchema).max(1_000),
    rules: validationRulesSchema,
    validation: z.array(validationResultSchema).max(100),
  })
  .strict();

export type ValidationRule = z.infer<typeof validationRuleSchema>;
export type DatasetValidationSaveInput = z.infer<typeof datasetValidationSaveInputSchema>;
export type ColumnQuality = z.infer<typeof columnQualitySchema>;
export type QualityFinding = z.infer<typeof qualityFindingSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type DatasetQualityReport = z.infer<typeof datasetQualityReportSchema>;

export function parseDatasetValidationSaveInput(value: unknown): DatasetValidationSaveInput {
  return datasetValidationSaveInputSchema.parse(value);
}

export function parseDatasetQualityReport(value: unknown): DatasetQualityReport {
  return datasetQualityReportSchema.parse(value);
}
