import { z } from "zod";
import { datasetIdSchema, datasetSummarySchema } from "./dataset.js";
import { safeGroupQueryPlanSchema } from "./group-query-plan.js";
import { safeQueryPlanSchema } from "./query-plan.js";

const cleanColumnNameSchema = z.string().trim().min(1).max(500);
const cleanScalarSchema = z.union([z.string().max(10_000), z.number().finite(), z.boolean(), z.null()]);
const dataCleanOperationKindSchema = z.enum(["select", "rename", "cast", "replace", "derive", "filter", "deduplicate", "fill-missing", "append", "union"]);

export const dataCleanSourceSchema = z.object({
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
}).strict();

export const dataCleanPredicateSchema = z.object({
  column: cleanColumnNameSchema,
  operator: z.enum(["equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal", "is-null", "is-not-null"]),
  value: cleanScalarSchema.optional(),
}).strict().superRefine((predicate, context) => {
  const nullOperator = predicate.operator === "is-null" || predicate.operator === "is-not-null";
  if (nullOperator && predicate.value !== undefined) context.addIssue({ code: "custom", path: ["value"], message: "Null predicates cannot contain a value" });
  if (!nullOperator && predicate.value === undefined) context.addIssue({ code: "custom", path: ["value"], message: "Comparison predicates require a value" });
});

const dataCleanExpressionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("literal"), value: cleanScalarSchema }).strict(),
  z.object({ kind: z.literal("concatenate"), columns: z.array(cleanColumnNameSchema).min(1).max(8), separator: z.string().max(64) }).strict(),
  z.object({
    kind: z.literal("arithmetic"),
    operator: z.enum(["add", "subtract", "multiply", "divide"]),
    leftColumn: cleanColumnNameSchema,
    rightColumn: cleanColumnNameSchema,
    onInvalid: z.enum(["reject", "null"]),
    divideByZero: z.enum(["reject", "null"]),
  }).strict(),
]);

const dataCleanFillSchema = z.discriminatedUnion("strategy", [
  z.object({ strategy: z.literal("literal"), value: cleanScalarSchema }).strict(),
  z.object({ strategy: z.literal("mean") }).strict(),
]);

const dataCleanOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("select"), columns: z.array(cleanColumnNameSchema).min(1).max(256) }).strict(),
  z.object({ kind: z.literal("rename"), column: cleanColumnNameSchema, name: cleanColumnNameSchema }).strict(),
  z.object({ kind: z.literal("cast"), column: cleanColumnNameSchema, to: z.enum(["boolean", "integer", "real", "datetime", "text"]), onInvalid: z.enum(["reject", "null"]) }).strict(),
  z.object({ kind: z.literal("replace"), column: cleanColumnNameSchema, match: cleanScalarSchema, replacement: cleanScalarSchema, mode: z.enum(["exact", "normalized-text"]) }).strict(),
  z.object({ kind: z.literal("derive"), name: cleanColumnNameSchema, expression: dataCleanExpressionSchema }).strict(),
  z.object({ kind: z.literal("filter"), predicate: dataCleanPredicateSchema }).strict(),
  z.object({ kind: z.literal("deduplicate"), keys: z.array(cleanColumnNameSchema).min(1).max(16), keep: z.enum(["first", "last"]) }).strict(),
  z.object({ kind: z.literal("fill-missing"), column: cleanColumnNameSchema, fill: dataCleanFillSchema }).strict(),
  z.object({ kind: z.literal("append"), sourceIndex: z.number().int().min(1).max(7) }).strict(),
  z.object({
    kind: z.literal("union"),
    sourceIndex: z.number().int().min(1).max(7),
    mapping: z.array(z.object({ source: cleanColumnNameSchema, target: cleanColumnNameSchema }).strict()).min(1).max(256),
  }).strict(),
]);

export const dataCleanPlanSchema = z.object({
  schemaVersion: z.literal(1),
  purpose: z.string().trim().min(1).max(500),
  sources: z.array(dataCleanSourceSchema).min(1).max(8),
  operations: z.array(dataCleanOperationSchema).min(1).max(40),
}).strict().superRefine((plan, context) => {
  const sources = new Set(plan.sources.map(({ datasetId, versionId }) => `${datasetId}:${versionId}`));
  if (sources.size !== plan.sources.length) context.addIssue({ code: "custom", path: ["sources"], message: "Clean-plan sources must be unique" });
  for (const [index, operation] of plan.operations.entries()) {
    if ((operation.kind === "append" || operation.kind === "union") && operation.sourceIndex >= plan.sources.length) {
      context.addIssue({ code: "custom", path: ["operations", index, "sourceIndex"], message: "Clean operation references an unavailable source" });
    }
  }
});

const dataCleanQualitySeveritySchema = z.enum(["blocking", "warning"]);
const dataCleanQualityRuleIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);
const dataCleanAcceptedTypeSchema = z.enum(["boolean", "integer", "real", "datetime", "text"]);
const dataCleanQualityRuleKindSchema = z.enum(["row-count", "non-null", "unique", "accepted-values", "accepted-type", "relationship-coverage", "aggregate-variance"]);

export const dataCleanQualityRuleSchema = z.discriminatedUnion("kind", [
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("row-count"), minimum: z.number().int().nonnegative().optional(), maximum: z.number().int().nonnegative().optional() }).strict(),
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("non-null"), column: cleanColumnNameSchema, minimumRatio: z.number().min(0).max(1) }).strict(),
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("unique"), columns: z.array(cleanColumnNameSchema).min(1).max(16) }).strict(),
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("accepted-values"), column: cleanColumnNameSchema, values: z.array(z.string().max(500)).min(1).max(50) }).strict(),
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("accepted-type"), column: cleanColumnNameSchema, acceptedTypes: z.array(dataCleanAcceptedTypeSchema).min(1).max(5) }).strict(),
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("relationship-coverage"), column: cleanColumnNameSchema, sourceIndex: z.number().int().min(0).max(7), sourceColumn: cleanColumnNameSchema, minimumRatio: z.number().min(0).max(1) }).strict(),
  z.object({ id: dataCleanQualityRuleIdSchema, severity: dataCleanQualitySeveritySchema, kind: z.literal("aggregate-variance"), column: cleanColumnNameSchema, sourceIndex: z.number().int().min(0).max(7), sourceColumn: cleanColumnNameSchema, maximumRelativeChange: z.number().min(0).max(100) }).strict(),
]);

export const dataCleanQualityPolicySchema = z.object({
  schemaVersion: z.literal(1),
  rules: z.array(dataCleanQualityRuleSchema).min(1).max(40),
}).strict().superRefine((policy, context) => {
  const ids = new Set<string>();
  for (const [index, rule] of policy.rules.entries()) {
    if (ids.has(rule.id)) context.addIssue({ code: "custom", path: ["rules", index, "id"], message: "Quality rule ids must be unique" });
    ids.add(rule.id);
    if (rule.kind === "row-count" && rule.minimum === undefined && rule.maximum === undefined) context.addIssue({ code: "custom", path: ["rules", index], message: "Row-count rules need at least one bound" });
    if (rule.kind === "row-count" && rule.minimum !== undefined && rule.maximum !== undefined && rule.minimum > rule.maximum) context.addIssue({ code: "custom", path: ["rules", index], message: "Row-count minimum cannot exceed maximum" });
    if (rule.kind === "accepted-values" && new Set(rule.values).size !== rule.values.length) context.addIssue({ code: "custom", path: ["rules", index, "values"], message: "Accepted values must be unique" });
    if (rule.kind === "accepted-type" && new Set(rule.acceptedTypes).size !== rule.acceptedTypes.length) context.addIssue({ code: "custom", path: ["rules", index, "acceptedTypes"], message: "Accepted types must be unique" });
  }
});

export const derivedTransformationPlanSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dataset-query"), plan: safeQueryPlanSchema }).strict(),
  z.object({ kind: z.literal("group-query"), groupPlan: safeGroupQueryPlanSchema }).strict(),
  z.object({ kind: z.literal("data-clean"), cleanPlan: dataCleanPlanSchema }).strict(),
]);

export const derivedMaterializationReviewSchema = z.object({
  kind: z.literal("one-use-approval"),
  planFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  qualityPolicyFingerprint: z.string().regex(/^[0-9a-f]{64}$/u).optional(),
  reviewedAt: z.string().datetime({ offset: true }),
}).strict();

export const derivedDatasetCreateInputSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  transformation: derivedTransformationPlanSchema,
  review: derivedMaterializationReviewSchema.optional(),
  qualityPolicy: dataCleanQualityPolicySchema.optional(),
}).strict();

export const dataCleanPreviewRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  cleanPlan: dataCleanPlanSchema,
  qualityPolicy: dataCleanQualityPolicySchema,
}).strict();

const dataCleanImpactSourceSchema = z.object({
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
  displayName: z.string().min(1).max(500),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(cleanColumnNameSchema).min(1).max(256),
}).strict();

const dataCleanOperationImpactSchema = z.object({
  ordinal: z.number().int().positive().max(40),
  kind: dataCleanOperationKindSchema,
  beforeRowCount: z.number().int().nonnegative(),
  afterRowCount: z.number().int().nonnegative(),
  beforeColumnCount: z.number().int().positive().max(256),
  afterColumnCount: z.number().int().positive().max(256),
  beforeColumns: z.array(cleanColumnNameSchema).min(1).max(256),
  afterColumns: z.array(cleanColumnNameSchema).min(1).max(256),
  affectedRowCount: z.number().int().nonnegative(),
}).strict();

export const dataCleanImpactPreviewSchema = z.object({
  planFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  sources: z.array(dataCleanImpactSourceSchema).min(1).max(8),
  resultRowCount: z.number().int().nonnegative(),
  resultColumns: z.array(cleanColumnNameSchema).min(1).max(256),
  operations: z.array(dataCleanOperationImpactSchema).min(1).max(40),
}).strict();

export const dataCleanQualityResultSchema = z.object({
  ruleId: dataCleanQualityRuleIdSchema,
  severity: dataCleanQualitySeveritySchema,
  kind: dataCleanQualityRuleKindSchema,
  passed: z.boolean(),
  failedRows: z.number().int().nonnegative(),
  observed: z.string().min(1).max(500),
  expected: z.string().min(1).max(500),
  sampleRowNumbers: z.array(z.number().int().positive()).max(20),
}).strict();

export const dataCleanQualityEvidenceSchema = z.object({
  policyFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  status: z.enum(["passed", "warning", "blocked"]),
  results: z.array(dataCleanQualityResultSchema).min(1).max(40),
}).strict();

export const dataCleanReviewPreviewSchema = z.object({
  impact: dataCleanImpactPreviewSchema,
  quality: dataCleanQualityEvidenceSchema,
}).strict();

export const dataCleanProposalSchema = z.object({
  approvalToken: z.string().regex(/^[0-9a-f]{64}$/u),
  expiresAt: z.string().datetime({ offset: true }),
  request: dataCleanPreviewRequestSchema,
  impact: dataCleanImpactPreviewSchema,
  quality: dataCleanQualityEvidenceSchema,
}).strict();

export const dataCleanApprovalSchema = z.object({
  approvalToken: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict();

export const derivedLineageParentSchema = z.object({
  ordinal: z.number().int().min(0).max(7),
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
  displayName: z.string().min(1).max(100),
}).strict();

export const derivedExecutionEvidenceSchema = z.object({
  executionId: datasetIdSchema,
  reviewKind: z.enum(["reviewed-plan", "one-use-approval", "reviewed-recompute"]),
  qualityGateStatus: z.enum(["not-configured", "passed", "warning"]),
  warnings: z.array(z.string().min(1).max(500)).max(40),
  cleanImpact: dataCleanImpactPreviewSchema.nullable(),
  quality: dataCleanQualityEvidenceSchema.nullable(),
}).strict();

export const derivedDatasetLineageSchema = z.object({
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
  transformationKind: z.enum(["dataset-query", "group-query", "data-clean"]),
  purpose: z.string().min(1).max(500),
  planFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  executionEvidence: derivedExecutionEvidenceSchema,
  parents: z.array(derivedLineageParentSchema).min(1).max(8),
  createdAt: z.string().datetime({ offset: true }),
}).strict();

export const derivedDatasetMaterializationResultSchema = z.object({
  dataset: datasetSummarySchema.refine(({ sourceKind }) => sourceKind === "derived", "Materialized datasets must be derived"),
  lineage: derivedDatasetLineageSchema,
}).strict();

export const derivedDependencyPlanSchema = z.object({
  sourceDatasetId: datasetIdSchema,
  orderedDatasetIds: z.array(datasetIdSchema).max(500),
  edgeCount: z.number().int().nonnegative().max(5_000),
}).strict();

export const derivedRecomputeEventSchema = z.object({
  id: datasetIdSchema,
  sourceDatasetId: datasetIdSchema,
  sourceVersionId: datasetIdSchema,
  targetDatasetId: datasetIdSchema,
  targetDisplayName: z.string().min(1).max(100),
  status: z.enum(["pending", "running", "succeeded", "paused", "failed", "cancelled"]),
  reasonKind: z.enum(["schema-drift", "quality-block", "stale-source", "execution-error", "cancelled"]).nullable(),
  error: z.string().min(1).max(2_000).nullable(),
  resultVersionId: datasetIdSchema.nullable(),
  attempt: z.number().int().min(0).max(3),
  createdAt: z.string().datetime({ offset: true }),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((event, context) => {
  if (event.status === "pending" && (event.startedAt !== null || event.finishedAt !== null || event.reasonKind !== null || event.error !== null || event.resultVersionId !== null)) context.addIssue({ code: "custom", message: "Pending recomputes cannot contain execution evidence" });
  if (event.status === "running" && (event.startedAt === null || event.finishedAt !== null || event.reasonKind !== null || event.error !== null || event.resultVersionId !== null)) context.addIssue({ code: "custom", message: "Running recomputes require only a start time" });
  if (event.status === "succeeded" && (event.startedAt === null || event.finishedAt === null || event.resultVersionId === null || event.reasonKind !== null || event.error !== null)) context.addIssue({ code: "custom", message: "Successful recomputes require a result version" });
  if (["paused", "failed", "cancelled"].includes(event.status) && (event.startedAt === null || event.finishedAt === null || event.resultVersionId !== null || event.reasonKind === null || event.error === null)) context.addIssue({ code: "custom", message: "Unsuccessful recomputes require diagnostic evidence" });
});

export const derivedRecomputeEventsSchema = z.array(derivedRecomputeEventSchema).max(100);

export const optionalDerivedDatasetLineageSchema = derivedDatasetLineageSchema.nullable();

export type DerivedTransformationPlan = z.infer<typeof derivedTransformationPlanSchema>;
export type DataCleanSource = z.infer<typeof dataCleanSourceSchema>;
export type DataCleanPredicate = z.infer<typeof dataCleanPredicateSchema>;
export type DataCleanOperation = z.infer<typeof dataCleanOperationSchema>;
export type DataCleanPlan = z.infer<typeof dataCleanPlanSchema>;
export type DataCleanQualityRule = z.infer<typeof dataCleanQualityRuleSchema>;
export type DataCleanQualityPolicy = z.infer<typeof dataCleanQualityPolicySchema>;
export type DataCleanQualityEvidence = z.infer<typeof dataCleanQualityEvidenceSchema>;
export type DataCleanReviewPreview = z.infer<typeof dataCleanReviewPreviewSchema>;
export type DerivedDatasetCreateInput = z.infer<typeof derivedDatasetCreateInputSchema>;
export type DerivedMaterializationReview = z.infer<typeof derivedMaterializationReviewSchema>;
export type DataCleanPreviewRequest = z.infer<typeof dataCleanPreviewRequestSchema>;
export type DataCleanImpactPreview = z.infer<typeof dataCleanImpactPreviewSchema>;
export type DataCleanProposal = z.infer<typeof dataCleanProposalSchema>;
export type DataCleanApproval = z.infer<typeof dataCleanApprovalSchema>;
export type DerivedDatasetLineage = z.infer<typeof derivedDatasetLineageSchema>;
export type DerivedExecutionEvidence = z.infer<typeof derivedExecutionEvidenceSchema>;
export type DerivedDatasetMaterializationResult = z.infer<typeof derivedDatasetMaterializationResultSchema>;
export type DerivedDependencyPlan = z.infer<typeof derivedDependencyPlanSchema>;
export type DerivedRecomputeEvent = z.infer<typeof derivedRecomputeEventSchema>;

export function parseDerivedDatasetCreateInput(value: unknown): DerivedDatasetCreateInput {
  return derivedDatasetCreateInputSchema.parse(value);
}

export function parseDataCleanPreviewRequest(value: unknown): DataCleanPreviewRequest {
  return dataCleanPreviewRequestSchema.parse(value);
}

export function parseDataCleanImpactPreview(value: unknown): DataCleanImpactPreview {
  return dataCleanImpactPreviewSchema.parse(value);
}

export function parseDataCleanQualityEvidence(value: unknown): DataCleanQualityEvidence {
  return dataCleanQualityEvidenceSchema.parse(value);
}

export function parseDataCleanReviewPreview(value: unknown): DataCleanReviewPreview {
  return dataCleanReviewPreviewSchema.parse(value);
}

export function parseDataCleanProposal(value: unknown): DataCleanProposal {
  return dataCleanProposalSchema.parse(value);
}

export function parseDataCleanApproval(value: unknown): DataCleanApproval {
  return dataCleanApprovalSchema.parse(value);
}

export function parseDerivedDatasetLineage(value: unknown): DerivedDatasetLineage {
  return derivedDatasetLineageSchema.parse(value);
}

export function parseOptionalDerivedDatasetLineage(value: unknown): DerivedDatasetLineage | null {
  return optionalDerivedDatasetLineageSchema.parse(value);
}

export function parseDerivedDatasetMaterializationResult(value: unknown): DerivedDatasetMaterializationResult {
  return derivedDatasetMaterializationResultSchema.parse(value);
}

export function parseDerivedDependencyPlan(value: unknown): DerivedDependencyPlan {
  return derivedDependencyPlanSchema.parse(value);
}

export function parseDerivedRecomputeEvent(value: unknown): DerivedRecomputeEvent {
  return derivedRecomputeEventSchema.parse(value);
}

export function parseDerivedRecomputeEvents(value: unknown): readonly DerivedRecomputeEvent[] {
  return derivedRecomputeEventsSchema.parse(value);
}
