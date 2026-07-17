import { z } from "zod";
import { aggregateExplanationSchema } from "./aggregate-explanation.js";
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
  payload: z.object({ explanation: aggregateExplanationSchema }).strict(),
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

export const conversationAppendInputSchema = z.object({
  target: conversationTargetSchema,
  entry: conversationEntryInputSchema,
}).strict();

export type ConversationTarget = z.infer<typeof conversationTargetSchema>;
export type ConversationEntryInput = z.infer<typeof conversationEntryInputSchema>;
export type ConversationEntry = z.infer<typeof conversationEntrySchema>;
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
export type ConversationAppendInput = z.infer<typeof conversationAppendInputSchema>;

export function parseConversationTarget(value: unknown): ConversationTarget {
  return conversationTargetSchema.parse(value);
}

export function parseConversationThread(value: unknown): ConversationThread {
  return conversationThreadSchema.parse(value);
}

export function parseOptionalConversationThread(value: unknown): ConversationThread | null {
  return conversationThreadSchema.nullable().parse(value);
}

export function parseConversationAppendInput(value: unknown): ConversationAppendInput {
  return conversationAppendInputSchema.parse(value);
}
