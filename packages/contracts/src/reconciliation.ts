import { z } from "zod";
import { datasetIdSchema } from "./dataset.js";

const boundedNameSchema = z.string().trim().min(1).max(200);
const datasetVersionReferenceSchema = z.object({ datasetId: datasetIdSchema, versionId: datasetIdSchema }).strict();
const normalizationSchema = z.enum(["trim", "case-fold", "collapse-whitespace"]);

export const comparisonCategorySchema = z.enum([
  "matched", "tolerance-matched", "left-unmatched", "right-unmatched",
  "left-duplicate", "right-duplicate", "conflict", "pending",
]);

const matchKeySchema = z.object({
  leftColumn: boundedNameSchema,
  rightColumn: boundedNameSchema,
  normalization: z.array(normalizationSchema).max(3).refine((items) => new Set(items).size === items.length, "normalizers must be unique"),
}).strict();

const amountToleranceSchema = z.object({
  leftColumn: boundedNameSchema,
  rightColumn: boundedNameSchema,
  absolute: z.number().finite().nonnegative().max(1_000_000_000),
}).strict();

const dateToleranceSchema = z.object({
  leftColumn: boundedNameSchema,
  rightColumn: boundedNameSchema,
  days: z.number().int().nonnegative().max(366),
}).strict();

export const comparisonPlanSchema = z.object({
  schemaVersion: z.literal(1),
  purpose: boundedNameSchema,
  sources: z.object({ left: datasetVersionReferenceSchema, right: datasetVersionReferenceSchema }).strict(),
  match: z.object({
    keys: z.array(matchKeySchema).min(1).max(8),
    cardinality: z.enum(["one-to-one", "one-to-many"]),
    amountTolerance: amountToleranceSchema.optional(),
    dateTolerance: dateToleranceSchema.optional(),
  }).strict(),
  budgets: z.object({
    maximumCandidatePairs: z.number().int().positive().max(1_000_000),
    timeoutMs: z.number().int().min(100).max(120_000),
  }).strict(),
}).strict().superRefine((plan, context) => {
  if (plan.sources.left.datasetId === plan.sources.right.datasetId && plan.sources.left.versionId === plan.sources.right.versionId) {
    context.addIssue({ code: "custom", path: ["sources", "right"], message: "comparison sources must identify distinct immutable versions" });
  }
  const pairs = plan.match.keys.map((key) => `${key.leftColumn}\u0000${key.rightColumn}`);
  if (new Set(pairs).size !== pairs.length) context.addIssue({ code: "custom", path: ["match", "keys"], message: "comparison key pairs must be unique" });
});

const controlTotalSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u),
  leftColumn: boundedNameSchema,
  rightColumn: boundedNameSchema,
  aggregation: z.literal("sum"),
  tolerance: z.number().finite().nonnegative().max(1_000_000_000),
}).strict();

export const reconciliationPlanSchema = z.object({
  schemaVersion: z.literal(1),
  purpose: boundedNameSchema,
  comparison: comparisonPlanSchema,
  controlTotals: z.array(controlTotalSchema).min(1).max(16).refine((items) => new Set(items.map(({ id }) => id)).size === items.length, "control total IDs must be unique"),
  unresolvedPolicy: z.literal("review-required"),
}).strict();

const reconciliationSourceEvidenceSchema = z.object({
  side: z.enum(["left", "right"]),
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
  displayName: z.string().trim().min(1).max(500),
  rowCount: z.number().int().nonnegative().max(200_000),
  qualityScore: z.number().int().min(0).max(100),
}).strict();

const reconciliationCountsSchema = z.object({
  matched: z.number().int().nonnegative(),
  toleranceMatched: z.number().int().nonnegative(),
  leftUnmatched: z.number().int().nonnegative(),
  rightUnmatched: z.number().int().nonnegative(),
  leftDuplicate: z.number().int().nonnegative(),
  rightDuplicate: z.number().int().nonnegative(),
  conflict: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
}).strict();

const reconciliationControlTotalResultSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u),
  leftValue: z.number().finite(),
  rightValue: z.number().finite(),
  difference: z.number().finite(),
  tolerance: z.number().finite().nonnegative(),
  balanced: z.boolean(),
}).strict();

export const reconciliationPreviewSchema = z.object({
  planFingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
  sources: z.array(reconciliationSourceEvidenceSchema).length(2),
  candidatePairs: z.number().int().nonnegative().max(1_000_000),
  counts: reconciliationCountsSchema,
  controlTotals: z.array(reconciliationControlTotalResultSchema).min(1).max(16),
  limitations: z.array(z.string().min(1).max(500)).min(1).max(10),
}).strict();

export const reconciliationPreviewRequestSchema = z.object({ plan: reconciliationPlanSchema }).strict();

export const reconciliationProposalSchema = z.object({
  approvalToken: z.string().regex(/^[0-9a-f]{64}$/u),
  expiresAt: z.string().datetime({ offset: true }),
  request: reconciliationPreviewRequestSchema,
  preview: reconciliationPreviewSchema,
}).strict();

export const reconciliationApprovalSchema = z.object({ approvalToken: z.string().regex(/^[0-9a-f]{64}$/u) }).strict();

const comparisonClassificationSchema = z.object({
  category: comparisonCategorySchema,
  leftRowNumber: z.number().int().positive().optional(),
  rightRowNumber: z.number().int().positive().optional(),
  key: z.string().max(4_000),
  reason: z.string().min(1).max(500),
}).strict().superRefine((item, context) => {
  if (item.leftRowNumber === undefined && item.rightRowNumber === undefined) context.addIssue({ code: "custom", message: "classification requires at least one row reference" });
  if (["matched", "tolerance-matched", "conflict"].includes(item.category) && (item.leftRowNumber === undefined || item.rightRowNumber === undefined)) context.addIssue({ code: "custom", message: "paired classification requires both row references" });
});

export const reconciliationArtifactSchema = reconciliationPreviewSchema.extend({
  schemaVersion: z.literal(1),
  id: datasetIdSchema,
  createdAt: z.string().datetime({ offset: true }),
  plan: reconciliationPlanSchema,
  classifications: z.array(comparisonClassificationSchema).max(400_000),
  completion: z.object({ status: z.literal("completed"), classificationCount: z.number().int().nonnegative().max(400_000), reviewKind: z.enum(["one-use-approval", "reviewed-replay"]), definitionId: datasetIdSchema.nullable() }).strict(),
}).strict().superRefine((artifact, context) => {
  if (artifact.completion.classificationCount !== artifact.classifications.length) context.addIssue({ code: "custom", path: ["completion", "classificationCount"], message: "completion count must equal durable classifications" });
});

export const reconciliationArtifactListSchema = z.array(reconciliationArtifactSchema).max(20);
export const reconciliationDatasetIdsSchema = z.array(datasetIdSchema).min(1).max(8);

export const reconciliationDefinitionSchema = z.object({
  schemaVersion: z.literal(1), id: datasetIdSchema, plan: reconciliationPlanSchema,
  planFingerprint: z.string().regex(/^[0-9a-f]{64}$/u), active: z.boolean(),
  lastArtifactId: datasetIdSchema, createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }),
}).strict();

export const reconciliationReplayEventSchema = z.object({
  schemaVersion: z.literal(1), id: datasetIdSchema, definitionId: datasetIdSchema,
  triggerDatasetId: datasetIdSchema, triggerVersionId: datasetIdSchema,
  status: z.enum(["pending", "running", "succeeded", "paused", "failed", "cancelled"]),
  reasonKind: z.enum(["schema-drift", "cardinality-change", "control-total-change", "quality-change", "stale-source", "execution-error", "cancelled"]).nullable(),
  error: z.string().min(1).max(2_000).nullable(), artifactId: datasetIdSchema.nullable(), attempt: z.number().int().min(0).max(3),
  createdAt: z.string().datetime({ offset: true }), startedAt: z.string().datetime({ offset: true }).nullable(), finishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((event, context) => {
  const issue = (message: string) => context.addIssue({ code: "custom", message });
  if (event.status === "pending" && (event.attempt >= 3 || event.reasonKind !== null || event.error !== null || event.artifactId !== null || event.startedAt !== null || event.finishedAt !== null)) issue("pending replay state is inconsistent");
  if (event.status === "running" && (event.attempt < 1 || event.reasonKind !== null || event.error !== null || event.artifactId !== null || event.startedAt === null || event.finishedAt !== null)) issue("running replay state is inconsistent");
  if (event.status === "succeeded" && (event.attempt < 1 || event.reasonKind !== null || event.error !== null || event.artifactId === null || event.startedAt === null || event.finishedAt === null)) issue("succeeded replay state is inconsistent");
  if (event.status === "paused" && (event.attempt < 1 || !["schema-drift", "cardinality-change", "control-total-change", "quality-change", "stale-source"].includes(event.reasonKind ?? "") || event.error === null || event.artifactId !== null || event.startedAt === null || event.finishedAt === null)) issue("paused replay state is inconsistent");
  if (event.status === "failed" && (event.attempt < 1 || event.reasonKind !== "execution-error" || event.error === null || event.artifactId !== null || event.startedAt === null || event.finishedAt === null)) issue("failed replay state is inconsistent");
  if (event.status === "cancelled" && (!["stale-source", "cancelled"].includes(event.reasonKind ?? "") || event.error === null || event.artifactId !== null || event.finishedAt === null)) issue("cancelled replay state is inconsistent");
});
export const reconciliationReplayEventsSchema = z.array(reconciliationReplayEventSchema).max(1_000);

export type ComparisonPlan = z.infer<typeof comparisonPlanSchema>;
export type ReconciliationPlan = z.infer<typeof reconciliationPlanSchema>;
export type ComparisonCategory = z.infer<typeof comparisonCategorySchema>;
export type ReconciliationPreview = z.infer<typeof reconciliationPreviewSchema>;
export type ReconciliationPreviewRequest = z.infer<typeof reconciliationPreviewRequestSchema>;
export type ReconciliationProposal = z.infer<typeof reconciliationProposalSchema>;
export type ReconciliationArtifact = z.infer<typeof reconciliationArtifactSchema>;
export type ReconciliationDefinition = z.infer<typeof reconciliationDefinitionSchema>;
export type ReconciliationReplayEvent = z.infer<typeof reconciliationReplayEventSchema>;

export function parseComparisonPlan(value: unknown): ComparisonPlan {
  return comparisonPlanSchema.parse(value);
}

export function parseReconciliationPlan(value: unknown): ReconciliationPlan {
  return reconciliationPlanSchema.parse(value);
}

export function parseReconciliationPreviewRequest(value: unknown): ReconciliationPreviewRequest { return reconciliationPreviewRequestSchema.parse(value); }
export function parseReconciliationPreview(value: unknown): ReconciliationPreview { return reconciliationPreviewSchema.parse(value); }
export function parseReconciliationProposal(value: unknown): ReconciliationProposal { return reconciliationProposalSchema.parse(value); }
export function parseReconciliationApproval(value: unknown): z.infer<typeof reconciliationApprovalSchema> { return reconciliationApprovalSchema.parse(value); }
export function parseReconciliationArtifact(value: unknown): ReconciliationArtifact { return reconciliationArtifactSchema.parse(value); }
export function parseReconciliationArtifacts(value: unknown): readonly ReconciliationArtifact[] { return reconciliationArtifactListSchema.parse(value); }
export function parseReconciliationDatasetIds(value: unknown): readonly string[] { return reconciliationDatasetIdsSchema.parse(value); }
export function parseReconciliationDefinition(value: unknown): ReconciliationDefinition { return reconciliationDefinitionSchema.parse(value); }
export function parseReconciliationReplayEvent(value: unknown): ReconciliationReplayEvent { return reconciliationReplayEventSchema.parse(value); }
export function parseReconciliationReplayEvents(value: unknown): readonly ReconciliationReplayEvent[] { return reconciliationReplayEventsSchema.parse(value); }
