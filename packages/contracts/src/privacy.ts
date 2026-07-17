import { z } from "zod";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";

export const disclosureLevelSchema = z.enum(["schema-only", "schema-synthetic"]);

const modelContextColumnSchema = z
  .object({
    name: z.string().min(1).max(500),
    type: columnTypeSchema,
    nullable: z.boolean(),
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
export type ModelContext = z.infer<typeof modelContextSchema>;

export function parseDisclosureLevel(value: unknown): DisclosureLevel {
  return disclosureLevelSchema.parse(value);
}

export function parseModelContext(value: unknown): ModelContext {
  return modelContextSchema.parse(value);
}
