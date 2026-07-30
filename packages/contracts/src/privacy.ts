import { z } from "zod";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";

export const disclosureLevelSchema = z.enum(["schema-only", "schema-synthetic"]);
export const modelDisclosureLevelSchema = z.enum([
  "schema-only",
  "schema-synthetic",
  "aggregates",
  "explicit-rows",
]);

export const privacyPolicySchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(["local-private", "strict-private"]),
  localDlpEnabled: z.literal(true),
}).strict();

export const privacyDlpFindingSchema = z.object({
  kind: z.enum(["credential", "email", "phone", "government-id", "pasted-table"]),
  severity: z.enum(["high", "medium"]),
  label: z.string().trim().min(1).max(100),
}).strict();

export const privacyTextInspectionSchema = z.object({
  decision: z.enum(["allow", "block"]),
  findings: z.array(privacyDlpFindingSchema).max(8),
}).strict();

const modelContextColumnSchema = z
  .object({
    name: z.string().min(1).max(500),
    type: columnTypeSchema,
    nullable: z.boolean(),
    unique: z.boolean(),
  })
  .strict();

const syntheticCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const modelContextSchema = z
  .object({
    datasetId: datasetIdSchema,
    versionId: datasetIdSchema,
    disclosure: disclosureLevelSchema,
    columns: z.array(modelContextColumnSchema).min(1).max(256),
    syntheticRows: z.array(z.array(syntheticCellSchema)).max(5),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disclosure === "schema-only" && value.syntheticRows.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["syntheticRows"],
        message: "schema-only disclosure cannot contain examples",
      });
    }
    for (const [index, row] of value.syntheticRows.entries()) {
      if (row.length !== value.columns.length) {
        context.addIssue({
          code: "custom",
          path: ["syntheticRows", index],
          message: "synthetic row width must match the schema",
        });
      }
    }
  });

export type DisclosureLevel = z.infer<typeof disclosureLevelSchema>;
export type ModelDisclosureLevel = z.infer<typeof modelDisclosureLevelSchema>;
export type ModelContext = z.infer<typeof modelContextSchema>;
export type PrivacyPolicy = z.infer<typeof privacyPolicySchema>;
export type PrivacyDlpFinding = z.infer<typeof privacyDlpFindingSchema>;
export type PrivacyTextInspection = z.infer<typeof privacyTextInspectionSchema>;

export function parseDisclosureLevel(value: unknown): DisclosureLevel {
  return disclosureLevelSchema.parse(value);
}

export function parseModelContext(value: unknown): ModelContext {
  return modelContextSchema.parse(value);
}

export function parsePrivacyPolicy(value: unknown): PrivacyPolicy {
  return privacyPolicySchema.parse(value);
}

export function parsePrivacyTextInspection(value: unknown): PrivacyTextInspection {
  return privacyTextInspectionSchema.parse(value);
}
