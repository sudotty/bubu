import { z } from "zod";
import { aggregateExplanationSchema } from "./aggregate-explanation.js";
import { aggregateAgentRunSchema } from "./aggregate-agent.js";
import { dataTargetSchema } from "./data-target.js";
import { groupQueryPlanProposalSchema, safeGroupQueryPlanSchema, safeGroupQueryResultSchema } from "./group-query-plan.js";
import { queryPlanProposalSchema, safeQueryPlanSchema, safeQueryResultSchema } from "./query-plan.js";
import { datasetIdSchema } from "./dataset.js";

export const conversationIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);

export const conversationTargetSchema = dataTargetSchema;

const questionEntryInputSchema = z.object({
  kind: z.literal("question"),
  role: z.literal("user"),
  payload: z.object({ question: z.string().trim().min(1).max(20_000) }).strict(),
}).strict();

const planEntryInputSchema = z.object({
  kind: z.literal("plan"),
  role: z.literal("assistant"),
  payload: z.object({ proposal: z.union([queryPlanProposalSchema, groupQueryPlanProposalSchema]) }).strict(),
}).strict();

const resultPayloadSchema = z.object({
  result: z.union([safeQueryResultSchema, safeGroupQueryResultSchema]),
  sourcePlan: z.union([safeQueryPlanSchema, safeGroupQueryPlanSchema]).optional(),
}).strict().superRefine((payload, context) => {
  if (!payload.sourcePlan) return;
  const matches = "datasetId" in payload.result && "datasetId" in payload.sourcePlan
    ? payload.result.datasetId === payload.sourcePlan.datasetId &&
      payload.result.versionId === payload.sourcePlan.versionId
    : "groupId" in payload.result && "groupId" in payload.sourcePlan &&
      payload.result.groupId === payload.sourcePlan.groupId &&
      payload.result.sourceVersions.length === payload.sourcePlan.sources.length &&
      payload.result.sourceVersions.every((source, index) => {
        const planned = payload.sourcePlan && "sources" in payload.sourcePlan
          ? payload.sourcePlan.sources[index]
          : undefined;
        return source.datasetId === planned?.datasetId && source.versionId === planned.versionId;
      });
  if (!matches) {
    context.addIssue({
      code: "custom",
      path: ["sourcePlan"],
      message: "A result and source plan must reference the same immutable source",
    });
  }
});

const resultEntryInputSchema = z.object({
  kind: z.literal("result"),
  role: z.literal("assistant"),
  payload: resultPayloadSchema,
}).strict();

const insightEntryInputSchema = z.object({
  kind: z.literal("insight"),
  role: z.literal("assistant"),
  payload: z.union([
    z.object({ explanation: aggregateExplanationSchema }).strict(),
    z.object({ agentRun: aggregateAgentRunSchema }).strict(),
    z.object({
      automation: z.object({
        eventId: datasetIdSchema,
        targetDatasetId: datasetIdSchema,
        targetDisplayName: z.string().min(1).max(100),
        sourceVersionId: datasetIdSchema,
        resultVersionId: datasetIdSchema.nullable(),
        status: z.enum(["succeeded", "paused", "failed", "cancelled"]),
        reasonKind: z.enum(["schema-drift", "quality-block", "stale-source", "execution-error", "cancelled"]).nullable(),
        message: z.string().min(1).max(2_000),
      }).strict(),
    }).strict(),
  ]),
}).strict();

const errorEntryInputSchema = z.object({
  kind: z.literal("error"),
  role: z.literal("system"),
  payload: z.object({ message: z.string().trim().min(1).max(2_000) }).strict(),
}).strict();

export const conversationEntryInputSchema = z.discriminatedUnion("kind", [
  questionEntryInputSchema,
  planEntryInputSchema,
  resultEntryInputSchema,
  insightEntryInputSchema,
  errorEntryInputSchema,
]);

const storedEntryFields = {
  id: conversationIdSchema,
  threadId: conversationIdSchema,
  ordinal: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
} as const;

export const conversationEntrySchema = z.discriminatedUnion("kind", [
  questionEntryInputSchema.extend(storedEntryFields).strict(),
  planEntryInputSchema.extend(storedEntryFields).strict(),
  resultEntryInputSchema.extend(storedEntryFields).strict(),
  insightEntryInputSchema.extend(storedEntryFields).strict(),
  errorEntryInputSchema.extend(storedEntryFields).strict(),
]);

export const conversationThreadSchema = z.object({
  id: conversationIdSchema,
  target: conversationTargetSchema,
  title: z.string().trim().min(1).max(100),
  entries: z.array(conversationEntrySchema).max(500),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();

export const conversationThreadSummarySchema = conversationThreadSchema.omit({ entries: true });

export const conversationEntryPageRequestSchema = z.object({
  threadId: conversationIdSchema,
  beforeOrdinal: z.number().int().positive(),
  limit: z.number().int().min(20).max(100).default(100),
}).strict();

export const conversationEntryPageSchema = z.object({
  threadId: conversationIdSchema,
  entries: z.array(conversationEntrySchema).max(100),
  nextBeforeOrdinal: z.number().int().positive().nullable(),
  totalEntries: z.number().int().nonnegative().max(10_000),
}).strict();

export const conversationCreateInputSchema = z.object({
  target: conversationTargetSchema,
  title: z.string().trim().min(1).max(100).optional(),
}).strict();

export const conversationRenameInputSchema = z.object({
  threadId: conversationIdSchema,
  title: z.string().trim().min(1).max(100),
}).strict();

export const conversationArchiveInputSchema = z.object({
  threadId: conversationIdSchema,
  archived: z.boolean(),
}).strict();

export const conversationDeleteInputSchema = z.object({
  threadId: conversationIdSchema,
  expectedTitle: z.string().trim().min(1).max(100),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const conversationRetentionPolicySchema = z.object({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  retentionDays: z.number().int().min(30).max(3_650),
}).strict();

export const conversationDeletionResultSchema = z.object({
  schemaVersion: z.literal(1),
  threadId: conversationIdSchema,
  deletedEntryCount: z.number().int().nonnegative().max(10_000),
  reason: z.enum(["manual", "retention"]),
  deletedAt: z.string().datetime({ offset: true }),
}).strict();

export const conversationRetentionResultSchema = z.object({
  schemaVersion: z.literal(1),
  deletedThreadCount: z.number().int().nonnegative().max(10_000),
  deletedEntryCount: z.number().int().nonnegative().max(5_000_000),
  appliedAt: z.string().datetime({ offset: true }),
}).strict();

export const conversationListInputSchema = z.object({
  target: conversationTargetSchema,
  archived: z.boolean(),
}).strict();

export const conversationAppendInputSchema = z.object({
  target: conversationTargetSchema,
  threadId: conversationIdSchema.optional(),
  entry: conversationEntryInputSchema,
}).strict();

export type ConversationTarget = z.infer<typeof conversationTargetSchema>;
export type ConversationEntryInput = z.infer<typeof conversationEntryInputSchema>;
export type ConversationEntry = z.infer<typeof conversationEntrySchema>;
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
export type ConversationThreadSummary = z.infer<typeof conversationThreadSummarySchema>;
export type ConversationEntryPageRequest = z.infer<typeof conversationEntryPageRequestSchema>;
export type ConversationEntryPage = z.infer<typeof conversationEntryPageSchema>;
export type ConversationCreateInput = z.infer<typeof conversationCreateInputSchema>;
export type ConversationRenameInput = z.infer<typeof conversationRenameInputSchema>;
export type ConversationArchiveInput = z.infer<typeof conversationArchiveInputSchema>;
export type ConversationDeleteInput = z.infer<typeof conversationDeleteInputSchema>;
export type ConversationRetentionPolicy = z.infer<typeof conversationRetentionPolicySchema>;
export type ConversationDeletionResult = z.infer<typeof conversationDeletionResultSchema>;
export type ConversationRetentionResult = z.infer<typeof conversationRetentionResultSchema>;
export type ConversationListInput = z.infer<typeof conversationListInputSchema>;
export type ConversationAppendInput = z.infer<typeof conversationAppendInputSchema>;

export function parseConversationTarget(value: unknown): ConversationTarget {
  return conversationTargetSchema.parse(value);
}

export function parseConversationId(value: unknown): string {
  return conversationIdSchema.parse(value);
}

export function parseConversationThread(value: unknown): ConversationThread {
  return conversationThreadSchema.parse(value);
}

export function parseOptionalConversationThread(value: unknown): ConversationThread | null {
  return conversationThreadSchema.nullable().parse(value);
}

export function parseConversationThreadSummaryList(value: unknown): readonly ConversationThreadSummary[] {
  return z.array(conversationThreadSummarySchema).parse(value);
}

export function parseConversationEntryPageRequest(value: unknown): ConversationEntryPageRequest {
  return conversationEntryPageRequestSchema.parse(value);
}

export function parseConversationEntryPage(value: unknown): ConversationEntryPage {
  return conversationEntryPageSchema.parse(value);
}

export function parseConversationCreateInput(value: unknown): ConversationCreateInput {
  return conversationCreateInputSchema.parse(value);
}

export function parseConversationRenameInput(value: unknown): ConversationRenameInput {
  return conversationRenameInputSchema.parse(value);
}

export function parseConversationArchiveInput(value: unknown): ConversationArchiveInput {
  return conversationArchiveInputSchema.parse(value);
}

export function parseConversationDeleteInput(value: unknown): ConversationDeleteInput {
  return conversationDeleteInputSchema.parse(value);
}

export function parseConversationRetentionPolicy(value: unknown): ConversationRetentionPolicy {
  return conversationRetentionPolicySchema.parse(value);
}

export function parseConversationDeletionResult(value: unknown): ConversationDeletionResult {
  return conversationDeletionResultSchema.parse(value);
}

export function parseConversationRetentionResult(value: unknown): ConversationRetentionResult {
  return conversationRetentionResultSchema.parse(value);
}

export function parseConversationListInput(value: unknown): ConversationListInput {
  return conversationListInputSchema.parse(value);
}

export function parseConversationAppendInput(value: unknown): ConversationAppendInput {
  return conversationAppendInputSchema.parse(value);
}
