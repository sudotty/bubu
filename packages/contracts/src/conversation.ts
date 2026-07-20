import { z } from "zod";
import { aggregateExplanationSchema } from "./aggregate-explanation.js";
import { aggregateAgentRunSchema } from "./aggregate-agent.js";
import { dataTargetSchema } from "./data-target.js";
import { groupQueryPlanProposalSchema, safeGroupQueryPlanSchema, safeGroupQueryResultSchema } from "./group-query-plan.js";
import { queryPlanProposalSchema, safeQueryPlanSchema, safeQueryResultSchema } from "./query-plan.js";

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
export type ConversationCreateInput = z.infer<typeof conversationCreateInputSchema>;
export type ConversationRenameInput = z.infer<typeof conversationRenameInputSchema>;
export type ConversationArchiveInput = z.infer<typeof conversationArchiveInputSchema>;
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

export function parseConversationCreateInput(value: unknown): ConversationCreateInput {
  return conversationCreateInputSchema.parse(value);
}

export function parseConversationRenameInput(value: unknown): ConversationRenameInput {
  return conversationRenameInputSchema.parse(value);
}

export function parseConversationArchiveInput(value: unknown): ConversationArchiveInput {
  return conversationArchiveInputSchema.parse(value);
}

export function parseConversationListInput(value: unknown): ConversationListInput {
  return conversationListInputSchema.parse(value);
}

export function parseConversationAppendInput(value: unknown): ConversationAppendInput {
  return conversationAppendInputSchema.parse(value);
}
