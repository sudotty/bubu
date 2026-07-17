import { z } from "zod";
import { datasetGroupIdSchema } from "./dataset-group.js";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";
import { modelContextSchema } from "./privacy.js";

const columnNameSchema = z.string().trim().min(1).max(500);
const sourceIndexSchema = z.number().int().min(0).max(7);
const sourceColumnSchema = z
  .object({ sourceIndex: sourceIndexSchema, column: columnNameSchema })
  .strict();

const groupMeasureSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("count"), sourceIndex: sourceIndexSchema, column: columnNameSchema.nullable() }).strict(),
  z.object({ operation: z.enum(["sum", "average", "minimum", "maximum"]), sourceIndex: sourceIndexSchema, column: columnNameSchema }).strict(),
]);

const groupValueFilterSchema = z
  .object({
    sourceIndex: sourceIndexSchema,
    column: columnNameSchema,
    operator: z.enum(["equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal"]),
    value: z.string().max(10_000),
  })
  .strict();

const groupNullFilterSchema = z
  .object({
    sourceIndex: sourceIndexSchema,
    column: columnNameSchema,
    operator: z.enum(["is-null", "is-not-null"]),
  })
  .strict();

const groupSourceSchema = z
  .object({ datasetId: datasetIdSchema, versionId: datasetIdSchema })
  .strict();

export const safeGroupQueryPlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    groupId: datasetGroupIdSchema,
    purpose: z.string().trim().min(1).max(500),
    sources: z.array(groupSourceSchema).min(2).max(8),
    joins: z.array(z.object({
      leftSourceIndex: sourceIndexSchema,
      leftColumn: columnNameSchema,
      rightSourceIndex: sourceIndexSchema,
      rightColumn: columnNameSchema,
      type: z.enum(["inner", "left"]),
    }).strict()).min(1).max(7),
    dimensions: z.array(sourceColumnSchema).max(8),
    measures: z.array(groupMeasureSchema).max(8),
    filters: z.array(z.union([groupValueFilterSchema, groupNullFilterSchema])).max(20),
    sort: z.array(z.object({
      outputIndex: z.number().int().nonnegative().max(15),
      direction: z.enum(["ascending", "descending"]),
    }).strict()).max(3),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.dimensions.length + plan.measures.length === 0) {
      context.addIssue({ code: "custom", message: "Group query must select at least one output" });
    }
    if (plan.joins.length !== plan.sources.length - 1) {
      context.addIssue({ code: "custom", path: ["joins"], message: "Every additional source must have exactly one join" });
    }
    if (new Set(plan.sources.map(({ datasetId }) => datasetId)).size !== plan.sources.length) {
      context.addIssue({ code: "custom", path: ["sources"], message: "Group query sources must be unique" });
    }
    for (const [index, join] of plan.joins.entries()) {
      if (join.rightSourceIndex !== index + 1 || join.leftSourceIndex > index) {
        context.addIssue({
          code: "custom",
          path: ["joins", index],
          message: "Joins must add each source once to the connected tree",
        });
      }
    }
    const outputCount = plan.dimensions.length + plan.measures.length;
    const refs = [
      ...plan.dimensions.map(({ sourceIndex }) => sourceIndex),
      ...plan.measures.map(({ sourceIndex }) => sourceIndex),
      ...plan.filters.map(({ sourceIndex }) => sourceIndex),
    ];
    if (refs.some((sourceIndex) => sourceIndex >= plan.sources.length)) {
      context.addIssue({ code: "custom", message: "Column references must target a declared source" });
    }
    for (const [index, sort] of plan.sort.entries()) {
      if (sort.outputIndex >= outputCount) {
        context.addIssue({ code: "custom", path: ["sort", index], message: "Sort target must reference a selected output" });
      }
    }
  });

const groupResultColumnSchema = z.object({ label: z.string().min(1).max(500), type: columnTypeSchema }).strict();
const groupQueryCellSchema = z.union([z.string().max(10_000), z.number(), z.boolean(), z.null()]);

export const safeGroupQueryResultSchema = z
  .object({
    groupId: datasetGroupIdSchema,
    sourceVersions: z.array(groupSourceSchema).min(2).max(8),
    columns: z.array(groupResultColumnSchema).min(1).max(16),
    rows: z.array(z.array(groupQueryCellSchema)).max(200),
    truncated: z.boolean(),
  })
  .strict()
  .superRefine((result, context) => {
    for (const [index, row] of result.rows.entries()) {
      if (row.length !== result.columns.length) {
        context.addIssue({ code: "custom", path: ["rows", index], message: "Result row width must match selected outputs" });
      }
    }
  });

export const groupQueryRequestSchema = z.object({
  groupId: datasetGroupIdSchema,
  question: z.string().trim().min(1).max(20_000),
}).strict();

export const groupQueryPlanProposalSchema = z
  .object({
    question: z.string().trim().min(1).max(20_000),
    disclosedContexts: z.array(modelContextSchema).min(2).max(8),
    plan: safeGroupQueryPlanSchema,
  })
  .strict()
  .superRefine((proposal, context) => {
    const sourcesMatch = proposal.plan.sources.length === proposal.disclosedContexts.length &&
      proposal.plan.sources.every((source, index) => {
        const disclosed = proposal.disclosedContexts[index];
        return source.datasetId === disclosed?.datasetId && source.versionId === disclosed.versionId;
      });
    if (!sourcesMatch) {
      context.addIssue({ code: "custom", path: ["plan", "sources"], message: "Group plan sources must exactly match disclosed contexts" });
    }
  });

export type SafeGroupQueryPlan = z.infer<typeof safeGroupQueryPlanSchema>;
export type SafeGroupQueryResult = z.infer<typeof safeGroupQueryResultSchema>;
export type GroupQueryRequest = z.infer<typeof groupQueryRequestSchema>;
export type GroupQueryPlanProposal = z.infer<typeof groupQueryPlanProposalSchema>;

export function parseSafeGroupQueryPlan(value: unknown): SafeGroupQueryPlan {
  return safeGroupQueryPlanSchema.parse(value);
}

export function parseSafeGroupQueryPlanText(value: string): SafeGroupQueryPlan {
  if (value.length > 100_000) throw new Error("Model group query plan is too large");
  return parseSafeGroupQueryPlan(JSON.parse(value) as unknown);
}

export function parseSafeGroupQueryResult(value: unknown): SafeGroupQueryResult {
  return safeGroupQueryResultSchema.parse(value);
}

export function parseGroupQueryRequest(value: unknown): GroupQueryRequest {
  return groupQueryRequestSchema.parse(value);
}

export function parseGroupQueryPlanProposal(value: unknown): GroupQueryPlanProposal {
  return groupQueryPlanProposalSchema.parse(value);
}
