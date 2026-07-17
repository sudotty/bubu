import { z } from "zod";
import { datasetIdSchema } from "./dataset.js";
import { modelDisclosureLevelSchema } from "./privacy.js";
import { providerIdSchema, providerKindSchema } from "./provider.js";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const modelAuditStatusSchema = z.enum(["started", "succeeded", "failed", "cancelled"]);

export const modelAuditTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("system") }).strict(),
  z.object({ kind: z.literal("dataset"), id: datasetIdSchema }).strict(),
  z.object({ kind: z.literal("group"), id: datasetIdSchema }).strict(),
]);

export const modelAuditStartInputSchema = z.object({
  purpose: z.enum(["provider-connection-test", "query-plan", "group-query-plan", "aggregate-explanation", "aggregate-agent"]),
  target: modelAuditTargetSchema,
  disclosure: z.union([z.literal("none"), modelDisclosureLevelSchema]),
  providerId: providerIdSchema,
  providerKind: providerKindSchema,
  providerName: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  endpointOrigin: z.url().max(2_000),
  datasetCount: z.number().int().min(0).max(8),
  columnCount: z.number().int().min(0).max(2_048),
  syntheticRowCount: z.number().int().min(0).max(40),
  aggregateRowCount: z.number().int().min(0).max(50),
  relationshipCount: z.number().int().min(0).max(500),
  payloadBytes: z.number().int().min(1).max(250_000),
  estimatedInputTokens: z.number().int().min(1).max(250_000),
  maxOutputTokens: z.number().int().min(1).max(32_768),
  payloadSha256: sha256Schema,
  containsRawRows: z.literal(false),
}).strict().superRefine((input, context) => {
  if (input.target.kind === "system") {
    if (
      input.purpose !== "provider-connection-test" || input.disclosure !== "none" ||
      input.datasetCount !== 0 || input.columnCount !== 0 ||
      input.syntheticRowCount !== 0 || input.aggregateRowCount !== 0 || input.relationshipCount !== 0
    ) {
      context.addIssue({ code: "custom", message: "System model audits cannot disclose dataset context" });
    }
    return;
  }
  const validDatasetCount = input.target.kind === "dataset"
    ? input.datasetCount === 1
    : input.datasetCount >= 2;
  if (input.purpose === "aggregate-explanation" || input.purpose === "aggregate-agent") {
    if (
      input.disclosure !== "aggregates" || !validDatasetCount || input.columnCount < 2 ||
      input.syntheticRowCount !== 0 || input.aggregateRowCount < 1 || input.relationshipCount !== 0
    ) {
      context.addIssue({ code: "custom", message: "Aggregate model audit scope is inconsistent" });
    }
    return;
  }
  const expectedPurpose = input.target.kind === "dataset" ? "query-plan" : "group-query-plan";
  if (
    input.purpose !== expectedPurpose ||
    (input.disclosure !== "schema-only" && input.disclosure !== "schema-synthetic") ||
    !validDatasetCount || input.columnCount < 1 || input.aggregateRowCount !== 0
  ) {
    context.addIssue({ code: "custom", message: "Data model audit scope is inconsistent" });
  }
  const expectedSyntheticRows = input.disclosure === "schema-synthetic" ? input.datasetCount * 3 : 0;
  if (input.syntheticRowCount !== expectedSyntheticRows) {
    context.addIssue({ code: "custom", path: ["syntheticRowCount"], message: "Synthetic disclosure count is inconsistent" });
  }
  if (input.target.kind === "dataset" && input.relationshipCount !== 0) {
    context.addIssue({ code: "custom", path: ["relationshipCount"], message: "Single-dataset requests cannot disclose relationships" });
  }
});

export const modelAuditFinishInputSchema = z.object({
  id: datasetIdSchema,
  status: z.enum(["succeeded", "failed", "cancelled"]),
  inputTokens: z.number().int().nonnegative().max(100_000_000).nullable(),
  outputTokens: z.number().int().nonnegative().max(100_000_000).nullable(),
  totalTokens: z.number().int().nonnegative().max(100_000_000).nullable(),
  outputBytes: z.number().int().nonnegative().max(10 * 1024 * 1024),
  error: z.string().min(1).max(2_000).nullable(),
}).strict().superRefine((input, context) => {
  if (input.status === "succeeded" && input.error !== null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Successful model audits cannot contain an error" });
  }
  if (input.status !== "succeeded" && input.error === null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Unsuccessful model audits require an error" });
  }
});

export const modelAuditEventSchema = modelAuditStartInputSchema.safeExtend({
  id: datasetIdSchema,
  status: modelAuditStatusSchema,
  inputTokens: z.number().int().nonnegative().max(100_000_000).nullable(),
  outputTokens: z.number().int().nonnegative().max(100_000_000).nullable(),
  totalTokens: z.number().int().nonnegative().max(100_000_000).nullable(),
  outputBytes: z.number().int().nonnegative().max(10 * 1024 * 1024).nullable(),
  error: z.string().min(1).max(2_000).nullable(),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((event, context) => {
  if (event.status === "started" && (
    event.finishedAt !== null || event.error !== null || event.outputBytes !== null ||
    event.inputTokens !== null || event.outputTokens !== null || event.totalTokens !== null
  )) {
    context.addIssue({ code: "custom", message: "Started model audits cannot contain terminal fields" });
  }
  if (event.status !== "started" && event.finishedAt === null) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "Terminal model audits require a finish time" });
  }
  if (event.status === "succeeded" && event.error !== null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Successful model audits cannot contain an error" });
  }
  if ((event.status === "failed" || event.status === "cancelled") && event.error === null) {
    context.addIssue({ code: "custom", path: ["error"], message: "Unsuccessful model audits require an error" });
  }
});

export type ModelAuditTarget = z.infer<typeof modelAuditTargetSchema>;
export type ModelAuditStartInput = z.infer<typeof modelAuditStartInputSchema>;
export type ModelAuditFinishInput = z.infer<typeof modelAuditFinishInputSchema>;
export type ModelAuditEvent = z.infer<typeof modelAuditEventSchema>;

export function parseModelAuditStartInput(value: unknown): ModelAuditStartInput {
  return modelAuditStartInputSchema.parse(value);
}

export function parseModelAuditFinishInput(value: unknown): ModelAuditFinishInput {
  return modelAuditFinishInputSchema.parse(value);
}

export function parseModelAuditEvent(value: unknown): ModelAuditEvent {
  return modelAuditEventSchema.parse(value);
}

export function parseModelAuditEvents(value: unknown): readonly ModelAuditEvent[] {
  return z.array(modelAuditEventSchema).max(100).parse(value);
}
