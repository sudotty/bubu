import { z } from "zod";
import { datasetIdSchema } from "./dataset.js";
import { safeGroupQueryPlanSchema, safeGroupQueryResultSchema } from "./group-query-plan.js";
import { operationIdSchema } from "./operation.js";
import { safeQueryPlanSchema, safeQueryResultSchema } from "./query-plan.js";

export const workflowIdSchema = datasetIdSchema;
const workflowStepIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);

export const workflowTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dataset"), id: datasetIdSchema }).strict(),
  z.object({ kind: z.literal("group"), id: datasetIdSchema }).strict(),
]);

const datasetQueryStepSchema = z.object({
  id: workflowStepIdSchema,
  kind: z.literal("dataset-query"),
  plan: safeQueryPlanSchema,
  maxAttempts: z.number().int().min(1).max(3),
}).strict();

const groupQueryStepSchema = z.object({
  id: workflowStepIdSchema,
  kind: z.literal("group-query"),
  groupPlan: safeGroupQueryPlanSchema,
  maxAttempts: z.number().int().min(1).max(3),
}).strict();

export const workflowStepDefinitionSchema = z.discriminatedUnion("kind", [
  datasetQueryStepSchema,
  groupQueryStepSchema,
]);

export const workflowTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }).strict(),
  z.object({
    kind: z.literal("interval"),
    everyMinutes: z.number().int().min(60).max(31 * 24 * 60),
  }).strict(),
  z.object({ kind: z.literal("dataset-version") }).strict(),
]);

export const workflowDefinitionInputSchema = z.object({
  id: workflowIdSchema.optional(),
  name: z.string().trim().min(1).max(100),
  target: workflowTargetSchema,
  threadId: workflowIdSchema,
  trigger: workflowTriggerSchema,
  timeoutMs: z.number().int().min(1_000).max(10 * 60_000),
  steps: z.array(workflowStepDefinitionSchema).min(1).max(8),
}).strict().superRefine((definition, context) => {
  if (new Set(definition.steps.map(({ id }) => id)).size !== definition.steps.length) {
    context.addIssue({ code: "custom", path: ["steps"], message: "Workflow step identities must be unique" });
  }
  for (const [index, step] of definition.steps.entries()) {
    const expectedKind = step.kind === "dataset-query" ? "dataset" : "group";
    const targetId = step.kind === "dataset-query" ? step.plan.datasetId : step.groupPlan.groupId;
    if (definition.target.kind !== expectedKind || definition.target.id !== targetId) {
      context.addIssue({
        code: "custom",
        path: ["steps", index, "plan"],
        message: "Workflow step must use the declared target",
      });
    }
  }
});

export const workflowDefinitionSchema = workflowDefinitionInputSchema.safeExtend({
  id: workflowIdSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  nextDueAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const workflowTriggerEventSchema = z.object({
  id: workflowIdSchema,
  workflowId: workflowIdSchema,
  definitionVersion: z.number().int().positive(),
  operationId: operationIdSchema,
  target: workflowTargetSchema,
  triggerKind: z.enum(["interval", "dataset-version"]),
  dueAt: z.string().datetime({ offset: true }),
  status: z.enum(["pending", "succeeded", "failed", "cancelled"]),
  runId: workflowIdSchema.nullable(),
  error: z.string().min(1).max(2_000).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((event, context) => {
  if (event.status === "pending" && (event.runId !== null || event.error !== null || event.finishedAt !== null)) {
    context.addIssue({ code: "custom", message: "Pending trigger events cannot contain terminal fields" });
  }
  if (event.status !== "pending" && event.finishedAt === null) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "Terminal trigger events require a finish time" });
  }
  if (event.status === "succeeded" && (event.runId === null || event.error !== null)) {
    context.addIssue({ code: "custom", message: "Successful trigger events require only a run identity" });
  }
  if ((event.status === "failed" || event.status === "cancelled") && event.error === null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Unsuccessful trigger events require an error" });
  }
});

export const workflowTriggerFinishInputSchema = z.object({
  id: workflowIdSchema,
  status: z.enum(["succeeded", "failed", "cancelled"]),
  runId: workflowIdSchema.nullable(),
  error: z.string().min(1).max(2_000).nullable(),
}).strict().superRefine((input, context) => {
  if (input.status === "succeeded" && (input.runId === null || input.error !== null)) {
    context.addIssue({ code: "custom", message: "Successful trigger completion requires only a run identity" });
  }
  if (input.status !== "succeeded" && input.error === null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Unsuccessful trigger completion requires an error" });
  }
});

const workflowStepResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dataset-query"), value: safeQueryResultSchema }).strict(),
  z.object({ kind: z.literal("group-query"), value: safeGroupQueryResultSchema }).strict(),
]);

const workflowStepRunSchema = z.object({
  id: workflowIdSchema,
  stepId: workflowStepIdSchema,
  ordinal: z.number().int().min(0).max(7),
  kind: z.enum(["dataset-query", "group-query"]),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]),
  attempt: z.number().int().min(1).max(3),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
  error: z.string().max(2_000).nullable(),
  result: workflowStepResultSchema.nullable(),
}).strict().superRefine((step, context) => {
  if (step.result !== null && step.result.kind !== step.kind) {
    context.addIssue({ code: "custom", path: ["result"], message: "Step result kind must match its definition" });
  }
  if (step.status === "succeeded" && step.result === null) {
    context.addIssue({ code: "custom", path: ["result"], message: "Successful workflow steps require a result" });
  }
  if (step.status === "running" && (step.finishedAt !== null || step.error !== null || step.result !== null)) {
    context.addIssue({ code: "custom", message: "Running workflow steps cannot contain terminal fields" });
  }
  if (step.status !== "running" && step.finishedAt === null) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "Terminal workflow steps require a finish time" });
  }
  if (step.status === "succeeded" && step.error !== null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Successful workflow steps cannot contain errors" });
  }
  if ((step.status === "failed" || step.status === "cancelled") && (step.error === null || step.result !== null)) {
    context.addIssue({ code: "custom", message: "Unsuccessful workflow steps require only an error" });
  }
});

export const workflowRunSchema = z.object({
  id: workflowIdSchema,
  workflowId: workflowIdSchema,
  definitionVersion: z.number().int().positive(),
  idempotencyKey: operationIdSchema,
  status: z.enum(["running", "succeeded", "failed", "cancelled"]),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
  error: z.string().max(2_000).nullable(),
  steps: z.array(workflowStepRunSchema).max(24),
}).strict().superRefine((run, context) => {
  if (run.status === "running" && (run.finishedAt !== null || run.error !== null)) {
    context.addIssue({ code: "custom", message: "Running workflows cannot contain terminal fields" });
  }
  if (run.status !== "running" && run.finishedAt === null) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "Terminal workflows require a finish time" });
  }
  if (run.status === "succeeded" && run.error !== null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Successful workflows cannot contain errors" });
  }
  if ((run.status === "failed" || run.status === "cancelled") && run.error === null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Unsuccessful workflows require an error" });
  }
});

export type WorkflowTarget = z.infer<typeof workflowTargetSchema>;
export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;
export type WorkflowStepDefinition = z.infer<typeof workflowStepDefinitionSchema>;
export type WorkflowDefinitionInput = z.infer<typeof workflowDefinitionInputSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type WorkflowTriggerEvent = z.infer<typeof workflowTriggerEventSchema>;
export type WorkflowTriggerFinishInput = z.infer<typeof workflowTriggerFinishInputSchema>;

export function parseWorkflowId(value: unknown): string {
  return workflowIdSchema.parse(value);
}

export function parseWorkflowTarget(value: unknown): WorkflowTarget {
  return workflowTargetSchema.parse(value);
}

export function parseWorkflowDefinitionInput(value: unknown): WorkflowDefinitionInput {
  return workflowDefinitionInputSchema.parse(value);
}

export function parseWorkflowDefinition(value: unknown): WorkflowDefinition {
  return workflowDefinitionSchema.parse(value);
}

export function parseWorkflowDefinitions(value: unknown): readonly WorkflowDefinition[] {
  return z.array(workflowDefinitionSchema).max(500).parse(value);
}

export function parseWorkflowRun(value: unknown): WorkflowRun {
  return workflowRunSchema.parse(value);
}

export function parseWorkflowRuns(value: unknown): readonly WorkflowRun[] {
  return z.array(workflowRunSchema).max(50).parse(value);
}

export function parseWorkflowTriggerEvents(value: unknown): readonly WorkflowTriggerEvent[] {
  return z.array(workflowTriggerEventSchema).max(100).parse(value);
}

export function parseWorkflowTriggerEvent(value: unknown): WorkflowTriggerEvent {
  return workflowTriggerEventSchema.parse(value);
}

export function parseWorkflowTriggerFinishInput(value: unknown): WorkflowTriggerFinishInput {
  return workflowTriggerFinishInputSchema.parse(value);
}
