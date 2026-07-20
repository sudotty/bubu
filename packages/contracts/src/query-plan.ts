import { z } from "zod";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";
import { modelContextSchema } from "./privacy.js";

const columnNameSchema = z.string().trim().min(1).max(500);

const queryMeasureSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("count"), column: columnNameSchema.nullable() }).strict(),
  z.object({ operation: z.enum(["sum", "average", "minimum", "maximum"]), column: columnNameSchema }).strict(),
]);

const valueFilterSchema = z
  .object({
    column: columnNameSchema,
    operator: z.enum(["equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal"]),
    value: z.string().max(10_000),
  })
  .strict();

const nullFilterSchema = z
  .object({
    column: columnNameSchema,
    operator: z.enum(["is-null", "is-not-null"]),
  })
  .strict();

export const safeQueryPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetId: datasetIdSchema,
    versionId: datasetIdSchema,
    purpose: z.string().trim().min(1).max(500),
    dimensions: z.array(columnNameSchema).max(8),
    measures: z.array(queryMeasureSchema).max(8),
    filters: z.array(z.union([valueFilterSchema, nullFilterSchema])).max(20),
    sort: z
      .array(
        z.object({
          outputIndex: z.number().int().nonnegative().max(15),
          direction: z.enum(["ascending", "descending"]),
        }).strict(),
      )
      .max(3),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.dimensions.length + plan.measures.length === 0) {
      context.addIssue({ code: "custom", message: "Query plan must select at least one output" });
    }
    if (new Set(plan.dimensions).size !== plan.dimensions.length) {
      context.addIssue({ code: "custom", path: ["dimensions"], message: "Dimensions must be unique" });
    }
    const outputCount = plan.dimensions.length + plan.measures.length;
    for (const [index, sort] of plan.sort.entries()) {
      if (sort.outputIndex >= outputCount) {
        context.addIssue({
          code: "custom",
          path: ["sort", index, "outputIndex"],
          message: "Sort target must reference a selected output",
        });
      }
    }
  });

const queryResultColumnSchema = z
  .object({
    label: z.string().min(1).max(500),
    type: columnTypeSchema,
  })
  .strict();

const queryCellSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]);

export const safeQueryResultSchema = z
  .object({
    datasetId: datasetIdSchema,
    versionId: datasetIdSchema,
    columns: z.array(queryResultColumnSchema).min(1).max(16),
    rows: z.array(z.array(queryCellSchema)).max(200),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((result, context) => {
    for (const [index, row] of result.rows.entries()) {
      if (row.length !== result.columns.length) {
        context.addIssue({
          code: "custom",
          path: ["rows", index],
          message: "Result row width must match selected outputs",
        });
      }
    }
  });

export const queryPlanProposalSchema = z
  .object({
    question: z.string().trim().min(1).max(20_000),
    disclosedContext: modelContextSchema,
    plan: safeQueryPlanSchema,
  })
  .strict()
  .superRefine((proposal, context) => {
    if (
      proposal.plan.datasetId !== proposal.disclosedContext.datasetId ||
      proposal.plan.versionId !== proposal.disclosedContext.versionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["plan"],
        message: "Query plan must target the disclosed dataset version",
      });
    }
  });

export const queryPlanRequestSchema = z
  .object({
    datasetId: datasetIdSchema,
    threadId: z.string().regex(/^[0-9a-f]{32}$/u).optional(),
    question: z.string().trim().min(1).max(20_000),
  })
  .strict();

export const queryPlanExecutionRequestSchema = z.object({
  plan: safeQueryPlanSchema,
  threadId: z.string().regex(/^[0-9a-f]{32}$/u),
}).strict();

export type SafeQueryPlan = z.infer<typeof safeQueryPlanSchema>;
export type SafeQueryResult = z.infer<typeof safeQueryResultSchema>;
export type QueryPlanProposal = z.infer<typeof queryPlanProposalSchema>;
export type QueryPlanRequest = z.infer<typeof queryPlanRequestSchema>;
export type QueryPlanExecutionRequest = z.infer<typeof queryPlanExecutionRequestSchema>;

export function parseSafeQueryPlan(value: unknown): SafeQueryPlan {
  return safeQueryPlanSchema.parse(value);
}

export function parseSafeQueryPlanText(value: string): SafeQueryPlan {
  if (value.length > 100_000) throw new Error("Model query plan is too large");
  return parseSafeQueryPlan(JSON.parse(value) as unknown);
}

export function parseSafeQueryResult(value: unknown): SafeQueryResult {
  return safeQueryResultSchema.parse(value);
}

export function parseQueryPlanProposal(value: unknown): QueryPlanProposal {
  return queryPlanProposalSchema.parse(value);
}

export function parseQueryPlanRequest(value: unknown): QueryPlanRequest {
  return queryPlanRequestSchema.parse(value);
}

export function parseQueryPlanExecutionRequest(value: unknown): QueryPlanExecutionRequest {
  return queryPlanExecutionRequestSchema.parse(value);
}
