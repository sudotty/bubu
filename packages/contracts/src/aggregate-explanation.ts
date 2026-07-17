import { z } from "zod";
import { columnTypeSchema } from "./dataset.js";
import { dataTargetSchema } from "./data-target.js";
import { providerIdSchema, providerKindSchema } from "./provider.js";
import { safeQueryPlanSchema } from "./query-plan.js";
import { safeGroupQueryPlanSchema } from "./group-query-plan.js";

const maximumAggregatePayloadBytes = 64 * 1024;
export const approvalTokenSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const endpointOriginSchema = z.url().max(2_000).refine((value) => {
  const parsed = new URL(value);
  return parsed.origin === value && parsed.username === "" && parsed.password === "";
}, "Model destination must be an origin without credentials or paths");
const aggregateCellSchema = z.union([
  z.string().max(1_000),
  z.number(),
  z.boolean(),
  z.null(),
]);

const aggregateColumnSchema = z.object({
  label: z.string().trim().min(1).max(500),
  type: columnTypeSchema,
}).strict();

export const modelDestinationSchema = z.object({
  providerId: providerIdSchema,
  providerKind: providerKindSchema,
  providerName: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  endpointOrigin: endpointOriginSchema,
}).strict();

export const aggregateDisclosureSchema = z.object({
  schemaVersion: z.literal(1),
  target: dataTargetSchema,
  question: z.string().trim().min(1).max(20_000),
  purpose: z.string().trim().min(1).max(500),
  sourceCount: z.number().int().min(1).max(8),
  columns: z.array(aggregateColumnSchema).min(2).max(16),
  rows: z.array(z.array(aggregateCellSchema)).min(1).max(50),
  truncated: z.boolean(),
  minimumGroupSize: z.literal(5),
}).strict().superRefine((value, context) => {
  for (const [index, row] of value.rows.entries()) {
    if (row.length !== value.columns.length) {
      context.addIssue({
        code: "custom",
        path: ["rows", index],
        message: "Aggregate row width must match the disclosed columns",
      });
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > maximumAggregatePayloadBytes) {
    context.addIssue({ code: "custom", message: "Aggregate disclosure exceeds its 64 KiB payload budget" });
  }
});

export const aggregateExplanationProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  destination: modelDestinationSchema,
  disclosure: aggregateDisclosureSchema,
}).strict();

export const aggregateExplanationApprovalSchema = z.object({
  approvalToken: approvalTokenSchema,
}).strict();

export const aggregateExplanationPreparationSchema = z.object({
  plan: z.union([safeQueryPlanSchema, safeGroupQueryPlanSchema]),
}).strict();

export const aggregateCellReferenceSchema = z.object({
  rowIndex: z.number().int().min(0).max(49),
  columnIndex: z.number().int().min(0).max(15),
}).strict();

export const aggregateExplanationContentSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().trim().min(1).max(2_000),
  findings: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().min(1).max(2_000),
    evidence: z.array(aggregateCellReferenceSchema).min(1).max(8),
  }).strict()).min(1).max(8),
  caveats: z.array(z.string().trim().min(1).max(500)).max(8),
  nextQuestions: z.array(z.string().trim().min(1).max(500)).max(6),
}).strict();

export const aggregateExplanationSchema = aggregateExplanationContentSchema.extend({
  disclosure: aggregateDisclosureSchema,
}).strict().superRefine((value, context) => {
  for (const [findingIndex, finding] of value.findings.entries()) {
    for (const [evidenceIndex, reference] of finding.evidence.entries()) {
      if (
        reference.rowIndex >= value.disclosure.rows.length ||
        reference.columnIndex >= value.disclosure.columns.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["findings", findingIndex, "evidence", evidenceIndex],
          message: "Evidence must reference a disclosed cell",
        });
      }
    }
  }
});

export type AggregateDisclosure = z.infer<typeof aggregateDisclosureSchema>;
export type AggregateExplanationProposal = z.infer<typeof aggregateExplanationProposalSchema>;
export type AggregateExplanationApproval = z.infer<typeof aggregateExplanationApprovalSchema>;
export type AggregateExplanationPreparation = z.infer<typeof aggregateExplanationPreparationSchema>;
export type AggregateExplanationContent = z.infer<typeof aggregateExplanationContentSchema>;
export type AggregateExplanation = z.infer<typeof aggregateExplanationSchema>;

export function parseAggregateDisclosure(value: unknown): AggregateDisclosure {
  return aggregateDisclosureSchema.parse(value);
}

export function parseAggregateExplanationProposal(value: unknown): AggregateExplanationProposal {
  return aggregateExplanationProposalSchema.parse(value);
}

export function parseAggregateExplanationApproval(value: unknown): AggregateExplanationApproval {
  return aggregateExplanationApprovalSchema.parse(value);
}

export function parseAggregateExplanationPreparation(value: unknown): AggregateExplanationPreparation {
  return aggregateExplanationPreparationSchema.parse(value);
}

export function parseAggregateExplanation(value: unknown): AggregateExplanation {
  return aggregateExplanationSchema.parse(value);
}

export function parseAggregateExplanationText(
  value: string,
  disclosure: AggregateDisclosure,
): AggregateExplanation {
  if (value.length > 100_000) throw new Error("Model aggregate explanation is too large");
  const content = aggregateExplanationContentSchema.parse(JSON.parse(value) as unknown);
  return parseAggregateExplanation({ ...content, disclosure });
}
