import { z } from "zod";
import { approvalTokenSchema, modelDestinationSchema } from "./aggregate-explanation.js";
import { columnTypeSchema, datasetIdSchema } from "./dataset.js";

const maximumExplicitRowPayloadBytes = 64 * 1024;
const explicitCellSchema = z.union([z.string().max(4_000), z.number(), z.boolean(), z.null()]);
const exactColumnNameSchema = z.string().trim().min(1).max(500).refine((value) => value !== "*", "Wildcard columns are not allowed");

function unique(values: readonly (string | number)[]): boolean {
  return new Set(values).size === values.length;
}

export const explicitRowDisclosureSelectionSchema = z.object({
  schemaVersion: z.literal(1),
  datasetId: datasetIdSchema,
  versionId: datasetIdSchema,
  purpose: z.string().trim().min(1).max(500),
  rowNumbers: z.array(z.number().int().min(1).max(100_000_000)).min(1).max(20)
    .refine(unique, "Row numbers must be unique"),
  columns: z.array(exactColumnNameSchema).min(1).max(16)
    .refine(unique, "Column names must be unique"),
}).strict();

const explicitRowSchema = z.object({
  rowNumber: z.number().int().min(1).max(100_000_000),
  cells: z.array(explicitCellSchema).min(1).max(16),
}).strict();

export const explicitRowDisclosurePreviewSchema = z.object({
  schemaVersion: z.literal(1),
  selection: explicitRowDisclosureSelectionSchema,
  columnTypes: z.array(columnTypeSchema).min(1).max(16),
  rows: z.array(explicitRowSchema).min(1).max(20),
  cellCount: z.number().int().min(1).max(320),
  payloadBytes: z.number().int().min(1).max(maximumExplicitRowPayloadBytes),
  payloadSha256: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict().superRefine((value, context) => {
  if (value.columnTypes.length !== value.selection.columns.length) {
    context.addIssue({ code: "custom", path: ["columnTypes"], message: "Column type width must match the selection" });
  }
  if (value.rows.length !== value.selection.rowNumbers.length) {
    context.addIssue({ code: "custom", path: ["rows"], message: "Preview rows must match the exact selection" });
  }
  for (const [index, row] of value.rows.entries()) {
    if (row.rowNumber !== value.selection.rowNumbers[index]) {
      context.addIssue({ code: "custom", path: ["rows", index, "rowNumber"], message: "Preview row order must match the selection" });
    }
    if (row.cells.length !== value.selection.columns.length) {
      context.addIssue({ code: "custom", path: ["rows", index, "cells"], message: "Preview row width must match the selected columns" });
    }
  }
  if (value.cellCount !== value.rows.length * value.selection.columns.length) {
    context.addIssue({ code: "custom", path: ["cellCount"], message: "Preview cell count is inconsistent" });
  }
});

export const explicitRowDisclosureProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  destination: modelDestinationSchema,
  preview: explicitRowDisclosurePreviewSchema,
}).strict();

export const explicitRowDisclosureApprovalSchema = z.object({
  approvalToken: approvalTokenSchema,
}).strict();

const explicitRowCellReferenceSchema = z.object({
  rowNumber: z.number().int().min(1).max(100_000_000),
  column: exactColumnNameSchema,
}).strict();

const explicitRowExplanationContentSchema = z.object({
  schemaVersion: z.literal(1),
  summary: z.string().trim().min(1).max(2_000),
  findings: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().min(1).max(2_000),
    evidence: z.array(explicitRowCellReferenceSchema).min(1).max(8),
  }).strict()).min(1).max(8),
  caveats: z.array(z.string().trim().min(1).max(500)).max(8),
}).strict();

export const explicitRowExplanationSchema = explicitRowExplanationContentSchema.extend({
  disclosure: explicitRowDisclosurePreviewSchema,
}).strict().superRefine((value, context) => {
  const selectedRows = new Set(value.disclosure.selection.rowNumbers);
  const selectedColumns = new Set(value.disclosure.selection.columns);
  for (const [findingIndex, finding] of value.findings.entries()) {
    for (const [evidenceIndex, evidence] of finding.evidence.entries()) {
      if (!selectedRows.has(evidence.rowNumber) || !selectedColumns.has(evidence.column)) {
        context.addIssue({ code: "custom", path: ["findings", findingIndex, "evidence", evidenceIndex], message: "Evidence must reference an explicitly disclosed cell" });
      }
    }
  }
});

export type ExplicitRowDisclosureSelection = z.infer<typeof explicitRowDisclosureSelectionSchema>;
export type ExplicitRowDisclosurePreview = z.infer<typeof explicitRowDisclosurePreviewSchema>;
export type ExplicitRowDisclosureProposal = z.infer<typeof explicitRowDisclosureProposalSchema>;
export type ExplicitRowDisclosureApproval = z.infer<typeof explicitRowDisclosureApprovalSchema>;
export type ExplicitRowExplanation = z.infer<typeof explicitRowExplanationSchema>;

export function parseExplicitRowDisclosureSelection(value: unknown): ExplicitRowDisclosureSelection {
  return explicitRowDisclosureSelectionSchema.parse(value);
}

export function parseExplicitRowDisclosurePreview(value: unknown): ExplicitRowDisclosurePreview {
  return explicitRowDisclosurePreviewSchema.parse(value);
}

export function parseExplicitRowDisclosureProposal(value: unknown): ExplicitRowDisclosureProposal {
  return explicitRowDisclosureProposalSchema.parse(value);
}

export function parseExplicitRowDisclosureApproval(value: unknown): ExplicitRowDisclosureApproval {
  return explicitRowDisclosureApprovalSchema.parse(value);
}

export function parseExplicitRowExplanationText(value: string, disclosure: ExplicitRowDisclosurePreview): ExplicitRowExplanation {
  if (value.length > 100_000) throw new Error("Model explicit-row explanation is too large");
  const content = explicitRowExplanationContentSchema.parse(JSON.parse(value) as unknown);
  return explicitRowExplanationSchema.parse({ ...content, disclosure });
}
