import { z } from "zod";
import {
  aggregateCellReferenceSchema,
  aggregateDisclosureSchema,
  aggregateExplanationContentSchema,
  aggregateExplanationSchema,
  approvalTokenSchema,
  modelDestinationSchema,
} from "./aggregate-explanation.js";
import { datasetIdSchema } from "./dataset.js";
import { safeGroupQueryPlanSchema } from "./group-query-plan.js";
import { safeQueryPlanSchema } from "./query-plan.js";

export const aggregateAgentBudget = Object.freeze({
  maxTurns: 4 as const,
  maxToolCalls: 3 as const,
  maxDurationMs: 60_000 as const,
  maxOutputTokensPerTurn: 2_048 as const,
  maxTotalOutputTokens: 8_192 as const,
});

export const aggregateAgentBudgetSchema = z.object({
  maxTurns: z.literal(aggregateAgentBudget.maxTurns),
  maxToolCalls: z.literal(aggregateAgentBudget.maxToolCalls),
  maxDurationMs: z.literal(aggregateAgentBudget.maxDurationMs),
  maxOutputTokensPerTurn: z.literal(aggregateAgentBudget.maxOutputTokensPerTurn),
  maxTotalOutputTokens: z.literal(aggregateAgentBudget.maxTotalOutputTokens),
}).strict();

const rankToolInputSchema = z.object({
  columnIndex: z.number().int().min(0).max(15),
  direction: z.enum(["ascending", "descending"]),
  limit: z.number().int().min(1).max(10),
}).strict();

const compareToolInputSchema = z.object({
  left: aggregateCellReferenceSchema,
  right: aggregateCellReferenceSchema,
}).strict();

const columnSummaryToolInputSchema = z.object({
  columnIndex: z.number().int().min(0).max(15),
}).strict();

export const aggregateAgentToolCallSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("rank"), input: rankToolInputSchema }).strict(),
  z.object({ name: z.literal("compare"), input: compareToolInputSchema }).strict(),
  z.object({ name: z.literal("column-summary"), input: columnSummaryToolInputSchema }).strict(),
]);

const rankedCellSchema = aggregateCellReferenceSchema.extend({ value: z.number() }).strict();
const comparedCellSchema = aggregateCellReferenceSchema.extend({ value: z.number() }).strict();

const rankObservationSchema = z.object({
  name: z.literal("rank"),
  input: rankToolInputSchema,
  output: z.object({ ranked: z.array(rankedCellSchema).min(1).max(10) }).strict(),
}).strict();

const compareObservationSchema = z.object({
  name: z.literal("compare"),
  input: compareToolInputSchema,
  output: z.object({
    left: comparedCellSchema,
    right: comparedCellSchema,
    difference: z.number(),
    percentDifference: z.number().nullable(),
  }).strict(),
}).strict();

const summaryExtremeSchema = aggregateCellReferenceSchema.extend({ value: z.number() }).strict();
const columnSummaryObservationSchema = z.object({
  name: z.literal("column-summary"),
  input: columnSummaryToolInputSchema,
  output: z.object({
    count: z.number().int().positive().max(50),
    sum: z.number(),
    average: z.number(),
    minimum: summaryExtremeSchema,
    maximum: summaryExtremeSchema,
  }).strict(),
}).strict();

export const aggregateAgentToolObservationSchema = z.discriminatedUnion("name", [
  rankObservationSchema,
  compareObservationSchema,
  columnSummaryObservationSchema,
]);

export const aggregateAgentDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    schemaVersion: z.literal(1),
    action: z.literal("tool"),
    call: aggregateAgentToolCallSchema,
  }).strict(),
  z.object({
    schemaVersion: z.literal(1),
    action: z.literal("finish"),
    report: aggregateExplanationContentSchema,
  }).strict(),
]);

export const aggregateAgentPreparationSchema = z.object({
  plan: z.union([safeQueryPlanSchema, safeGroupQueryPlanSchema]),
  goal: z.string().trim().min(1).max(2_000),
}).strict();

export const aggregateAgentProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  destination: modelDestinationSchema,
  disclosure: aggregateDisclosureSchema,
  budget: aggregateAgentBudgetSchema,
}).strict();

export const aggregateAgentApprovalSchema = z.object({
  approvalToken: approvalTokenSchema,
}).strict();

const agentToolTurnSchema = z.object({
  turn: z.number().int().min(1).max(4),
  auditId: datasetIdSchema,
  action: z.literal("tool"),
  observation: aggregateAgentToolObservationSchema,
}).strict();

const agentFinishTurnSchema = z.object({
  turn: z.number().int().min(1).max(4),
  auditId: datasetIdSchema,
  action: z.literal("finish"),
}).strict();

export const aggregateAgentRunSchema = z.object({
  schemaVersion: z.literal(1),
  id: datasetIdSchema,
  disclosure: aggregateDisclosureSchema,
  budget: aggregateAgentBudgetSchema,
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }),
  turns: z.array(z.discriminatedUnion("action", [agentToolTurnSchema, agentFinishTurnSchema])).min(1).max(4),
  report: aggregateExplanationContentSchema,
}).strict().superRefine((run, context) => {
  if (Date.parse(run.finishedAt) < Date.parse(run.startedAt)) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "Agent finish time cannot precede its start" });
  }
  if (run.turns.some((turn, index) => turn.turn !== index + 1)) {
    context.addIssue({ code: "custom", path: ["turns"], message: "Agent turns must be contiguous and ordered" });
  }
  if (run.turns.at(-1)?.action !== "finish" || run.turns.slice(0, -1).some(({ action }) => action === "finish")) {
    context.addIssue({ code: "custom", path: ["turns"], message: "A successful agent trace must finish exactly once at the end" });
  }
  if (new Set(run.turns.map(({ auditId }) => auditId)).size !== run.turns.length) {
    context.addIssue({ code: "custom", path: ["turns"], message: "Every agent turn must cite a distinct audit event" });
  }
  if (run.turns.filter(({ action }) => action === "tool").length > run.budget.maxToolCalls) {
    context.addIssue({ code: "custom", path: ["turns"], message: "Agent trace exceeds its tool-call budget" });
  }

  const explanation = aggregateExplanationSchema.safeParse({ ...run.report, disclosure: run.disclosure });
  if (!explanation.success) {
    for (const issue of explanation.error.issues) {
      context.addIssue({
        code: "custom",
        path: ["report", ...issue.path.filter((part) => part !== "disclosure")],
        message: issue.message,
      });
    }
  }
  run.turns.forEach((turn, index) => {
    if (turn.action === "tool") validateObservation(run.disclosure, turn.observation, context, index);
  });
});

function numericCell(
  disclosure: z.infer<typeof aggregateDisclosureSchema>,
  reference: { readonly rowIndex: number; readonly columnIndex: number },
): number | undefined {
  const value = disclosure.rows[reference.rowIndex]?.[reference.columnIndex];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 8;
}

function invalidObservation(context: z.RefinementCtx, turnIndex: number): void {
  context.addIssue({
    code: "custom",
    path: ["turns", turnIndex, "observation"],
    message: "Agent tool observation must be derived from the approved disclosure",
  });
}

function validateObservation(
  disclosure: z.infer<typeof aggregateDisclosureSchema>,
  observation: z.infer<typeof aggregateAgentToolObservationSchema>,
  context: z.RefinementCtx,
  turnIndex: number,
): void {
  if (observation.name === "rank") {
    const expected = disclosure.rows
      .map((row, rowIndex) => ({ rowIndex, value: row[observation.input.columnIndex] }))
      .filter((item): item is { rowIndex: number; value: number } =>
        typeof item.value === "number" && Number.isFinite(item.value))
      .sort((left, right) => observation.input.direction === "ascending"
        ? left.value - right.value || left.rowIndex - right.rowIndex
        : right.value - left.value || left.rowIndex - right.rowIndex)
      .slice(0, observation.input.limit);
    const valid = observation.output.ranked.length === expected.length &&
      observation.output.ranked.every((item, index) => {
        const wanted = expected[index];
        return item.columnIndex === observation.input.columnIndex && item.rowIndex === wanted?.rowIndex &&
          wanted !== undefined && approximatelyEqual(item.value, wanted.value);
      });
    if (!valid) invalidObservation(context, turnIndex);
    return;
  }
  if (observation.name === "compare") {
    const left = numericCell(disclosure, observation.input.left);
    const right = numericCell(disclosure, observation.input.right);
    const expectedDifference = left === undefined || right === undefined ? undefined : left - right;
    const expectedPercent = expectedDifference === undefined || right === undefined || right === 0
      ? null
      : expectedDifference / Math.abs(right) * 100;
    const valid = left !== undefined && right !== undefined &&
      observation.output.left.rowIndex === observation.input.left.rowIndex &&
      observation.output.left.columnIndex === observation.input.left.columnIndex &&
      observation.output.right.rowIndex === observation.input.right.rowIndex &&
      observation.output.right.columnIndex === observation.input.right.columnIndex &&
      approximatelyEqual(observation.output.left.value, left) &&
      approximatelyEqual(observation.output.right.value, right) &&
      expectedDifference !== undefined && approximatelyEqual(observation.output.difference, expectedDifference) &&
      (expectedPercent === null
        ? observation.output.percentDifference === null
        : observation.output.percentDifference !== null && approximatelyEqual(observation.output.percentDifference, expectedPercent));
    if (!valid) invalidObservation(context, turnIndex);
    return;
  }
  const values = disclosure.rows
    .map((row, rowIndex) => ({ rowIndex, value: row[observation.input.columnIndex] }))
    .filter((item): item is { rowIndex: number; value: number } =>
      typeof item.value === "number" && Number.isFinite(item.value));
  const first = values[0];
  if (!first) {
    invalidObservation(context, turnIndex);
    return;
  }
  const sum = values.reduce((total, item) => total + item.value, 0);
  const minimum = values.slice(1).reduce((best, item) => item.value < best.value ? item : best, first);
  const maximum = values.slice(1).reduce((best, item) => item.value > best.value ? item : best, first);
  const valid = observation.output.count === values.length &&
    approximatelyEqual(observation.output.sum, sum) &&
    approximatelyEqual(observation.output.average, sum / values.length) &&
    observation.output.minimum.rowIndex === minimum.rowIndex &&
    observation.output.minimum.columnIndex === observation.input.columnIndex &&
    approximatelyEqual(observation.output.minimum.value, minimum.value) &&
    observation.output.maximum.rowIndex === maximum.rowIndex &&
    observation.output.maximum.columnIndex === observation.input.columnIndex &&
    approximatelyEqual(observation.output.maximum.value, maximum.value);
  if (!valid) invalidObservation(context, turnIndex);
}

export type AggregateAgentBudget = z.infer<typeof aggregateAgentBudgetSchema>;
export type AggregateAgentToolCall = z.infer<typeof aggregateAgentToolCallSchema>;
export type AggregateAgentToolObservation = z.infer<typeof aggregateAgentToolObservationSchema>;
export type AggregateAgentDecision = z.infer<typeof aggregateAgentDecisionSchema>;
export type AggregateAgentPreparation = z.infer<typeof aggregateAgentPreparationSchema>;
export type AggregateAgentProposal = z.infer<typeof aggregateAgentProposalSchema>;
export type AggregateAgentApproval = z.infer<typeof aggregateAgentApprovalSchema>;
export type AggregateAgentRun = z.infer<typeof aggregateAgentRunSchema>;

export function parseAggregateAgentPreparation(value: unknown): AggregateAgentPreparation {
  return aggregateAgentPreparationSchema.parse(value);
}

export function parseAggregateAgentProposal(value: unknown): AggregateAgentProposal {
  return aggregateAgentProposalSchema.parse(value);
}

export function parseAggregateAgentApproval(value: unknown): AggregateAgentApproval {
  return aggregateAgentApprovalSchema.parse(value);
}

export function parseAggregateAgentToolCall(value: unknown): AggregateAgentToolCall {
  return aggregateAgentToolCallSchema.parse(value);
}

export function parseAggregateAgentToolObservation(value: unknown): AggregateAgentToolObservation {
  return aggregateAgentToolObservationSchema.parse(value);
}

export function parseAggregateAgentDecisionText(value: string): AggregateAgentDecision {
  if (value.length > 100_000) throw new Error("Model aggregate agent decision is too large");
  return aggregateAgentDecisionSchema.parse(JSON.parse(value) as unknown);
}

export function parseAggregateAgentRun(value: unknown): AggregateAgentRun {
  return aggregateAgentRunSchema.parse(value);
}
