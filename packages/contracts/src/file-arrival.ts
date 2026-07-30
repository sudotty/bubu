import { z } from "zod";
import { datasetIdSchema, datasetReplacementSelectionResultSchema } from "./dataset.js";

export const fileArrivalIdSchema = z.string().regex(/^[0-9a-f]{32}$/u);
const fileNameSchema = z.string().trim().min(1).max(500).refine((value) => !value.includes("/") && !value.includes("\\"), "file name must not contain a path");

export const fileArrivalCandidateSchema = z.object({
  datasetId: datasetIdSchema,
  displayName: z.string().trim().min(1).max(100),
  reason: z.enum(["schema-profile", "source-name", "display-name", "source-kind"]),
  confidence: z.enum(["high", "medium", "low"]),
}).strict();

export const fileArrivalItemSchema = z.object({
  id: fileArrivalIdSchema,
  fileName: fileNameSchema,
  detectedAt: z.string().datetime({ offset: true }),
  status: z.enum(["needs-review", "processing", "mapping-required", "completed", "failed", "dismissed"]),
  candidates: z.array(fileArrivalCandidateSchema).max(5),
  selectedDatasetId: datasetIdSchema.optional(),
  message: z.string().trim().min(1).max(500).optional(),
}).strict();

export const fileArrivalStateSchema = z.object({
  configured: z.boolean(),
  watchStatus: z.enum(["inactive", "active", "unavailable"]),
  folderLabel: z.string().trim().min(1).max(500).optional(),
  watchMessage: z.string().trim().min(1).max(500).optional(),
  items: z.array(fileArrivalItemSchema).max(100),
}).strict();

export const fileArrivalApprovalSchema = z.object({ arrivalId: fileArrivalIdSchema, datasetId: datasetIdSchema }).strict();
export const fileArrivalDismissalSchema = z.object({ arrivalId: fileArrivalIdSchema }).strict();
export const fileArrivalReplacementResultSchema = z.object({ arrival: fileArrivalItemSchema, replacement: datasetReplacementSelectionResultSchema }).strict();

export type FileArrivalCandidate = z.infer<typeof fileArrivalCandidateSchema>;
export type FileArrivalItem = z.infer<typeof fileArrivalItemSchema>;
export type FileArrivalState = z.infer<typeof fileArrivalStateSchema>;
export type FileArrivalApproval = z.infer<typeof fileArrivalApprovalSchema>;
export type FileArrivalReplacementResult = z.infer<typeof fileArrivalReplacementResultSchema>;

export const parseFileArrivalState = (value: unknown): FileArrivalState => fileArrivalStateSchema.parse(value);
export const parseFileArrivalApproval = (value: unknown): FileArrivalApproval => fileArrivalApprovalSchema.parse(value);
export const parseFileArrivalDismissal = (value: unknown) => fileArrivalDismissalSchema.parse(value);
