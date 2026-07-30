import { z } from "zod";

const reportValueSchema = z.union([z.string().max(100_000), z.number().finite(), z.boolean(), z.null()]);
const reportLabelSchema = z.string().trim().min(1).max(500);
export const reportFactSchema = z.object({ label: reportLabelSchema, value: reportValueSchema }).strict();
export const reportTableSchema = z.object({
  name: z.string().trim().min(1).max(100),
  columns: z.array(reportLabelSchema).min(1).max(64),
  rows: z.array(z.array(reportValueSchema).max(64)).max(5_000),
}).strict().superRefine((table, context) => table.rows.forEach((row, index) => { if (row.length !== table.columns.length) context.addIssue({ code: "custom", path: ["rows", index], message: "Report row width must match columns" }); }));

export const reportBundleInputSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(["clean", "reconciliation", "analysis"]),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2_000),
  deterministicFacts: z.array(reportFactSchema).max(100),
  tables: z.array(reportTableSchema).min(1).max(20),
  quality: z.array(reportFactSchema).max(100),
  exceptions: z.array(z.string().trim().min(1).max(1_000)).max(100),
  limitations: z.array(z.string().trim().min(1).max(1_000)).max(100),
  lineage: z.array(reportFactSchema).max(100),
  runMetadata: z.array(reportFactSchema).max(100),
  modelNarrative: z.string().trim().min(1).max(10_000).optional(),
}).strict();

export const reportBundleExportResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("exported"), bundleName: z.string().min(1).max(240), fileCount: z.number().int().min(5).max(30), manifestSha256: z.string().regex(/^[0-9a-f]{64}$/u) }).strict(),
  z.object({ status: z.literal("cancelled") }).strict(),
]);

export type ReportBundleInput = z.infer<typeof reportBundleInputSchema>;
export type ReportBundleExportResult = z.infer<typeof reportBundleExportResultSchema>;
export type ReportTable = z.infer<typeof reportTableSchema>;
export const parseReportBundleInput = (value: unknown): ReportBundleInput => reportBundleInputSchema.parse(value);
