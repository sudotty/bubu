import { z } from "zod";
import { approvalTokenSchema, modelDestinationSchema } from "./aggregate-explanation.js";
import { datasetIdSchema } from "./dataset.js";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const sourceKindSchema = z.enum(["text", "markdown", "pdf"]);

export const knowledgeSourceImportInputSchema = z.object({
  sourcePath: z.string().min(1).max(4_096),
  displayName: z.string().trim().min(1).max(200),
}).strict();

export const knowledgeSourceSchema = z.object({
  schemaVersion: z.literal(1),
  id: datasetIdSchema,
  versionId: datasetIdSchema,
  displayName: z.string().trim().min(1).max(200),
  kind: sourceKindSchema,
  sourceBytes: z.number().int().min(1).max(20 * 1024 * 1024),
  sourceSha256: sha256Schema,
  chunkCount: z.number().int().min(1).max(2_000),
  status: z.literal("ready"),
  importedAt: z.string().datetime({ offset: true }),
}).strict();

export const knowledgeCitationSchema = z.object({
  sourceId: datasetIdSchema,
  versionId: datasetIdSchema,
  chunkId: datasetIdSchema,
  ordinal: z.number().int().min(0).max(1_999),
  startLine: z.number().int().min(1).max(10_000_000),
  endLine: z.number().int().min(1).max(10_000_000),
  text: z.string().trim().min(1).max(8_000),
  score: z.number().min(0).max(1),
}).strict().refine((citation) => citation.endLine >= citation.startLine, "Citation line range is invalid");

export const knowledgeSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  sourceIds: z.array(datasetIdSchema).max(50).refine((values) => new Set(values).size === values.length, "Knowledge source IDs must be unique"),
  limit: z.number().int().min(1).max(12),
}).strict();

export const knowledgeDisclosurePreparationSchema = z.object({
  purpose: z.string().trim().min(1).max(500),
  search: knowledgeSearchInputSchema.extend({ sourceIds: z.array(datasetIdSchema).length(1) }).strict(),
}).strict();

export const knowledgeSearchResultSchema = z.object({
  schemaVersion: z.literal(1),
  query: z.string().trim().min(1).max(500),
  sourceVersions: z.array(z.object({ sourceId: datasetIdSchema, versionId: datasetIdSchema }).strict()).min(1).max(50),
  citations: z.array(knowledgeCitationSchema).max(12),
  searchedAt: z.string().datetime({ offset: true }),
}).strict();

export const knowledgeDisclosurePreviewSchema = z.object({
  schemaVersion: z.literal(1),
  purpose: z.string().trim().min(1).max(500),
  query: z.string().trim().min(1).max(500),
  citations: z.array(knowledgeCitationSchema).min(1).max(12),
  payloadBytes: z.number().int().min(1).max(64 * 1024),
  payloadSha256: sha256Schema,
}).strict().refine((preview) => new Set(preview.citations.map(({ chunkId }) => chunkId)).size === preview.citations.length, "Disclosed chunks must be unique");

export const knowledgeDisclosureProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  destination: modelDestinationSchema,
  preview: knowledgeDisclosurePreviewSchema,
}).strict();

export const knowledgeDisclosureApprovalSchema = z.object({ approvalToken: approvalTokenSchema }).strict();

const knowledgeAnswerContentSchema = z.object({
  schemaVersion: z.literal(1),
  answer: z.string().trim().min(1).max(8_000),
  citations: z.array(z.object({ chunkId: datasetIdSchema }).strict()).min(1).max(12),
}).strict();

export const knowledgeAnswerSchema = knowledgeAnswerContentSchema.extend({ disclosure: knowledgeDisclosurePreviewSchema }).strict();

export type KnowledgeSourceImportInput = z.infer<typeof knowledgeSourceImportInputSchema>;
export type KnowledgeSource = z.infer<typeof knowledgeSourceSchema>;
export type KnowledgeSearchInput = z.infer<typeof knowledgeSearchInputSchema>;
export type KnowledgeDisclosurePreparation = z.infer<typeof knowledgeDisclosurePreparationSchema>;
export type KnowledgeSearchResult = z.infer<typeof knowledgeSearchResultSchema>;
export type KnowledgeCitation = z.infer<typeof knowledgeCitationSchema>;
export type KnowledgeDisclosurePreview = z.infer<typeof knowledgeDisclosurePreviewSchema>;
export type KnowledgeDisclosureProposal = z.infer<typeof knowledgeDisclosureProposalSchema>;
export type KnowledgeDisclosureApproval = z.infer<typeof knowledgeDisclosureApprovalSchema>;
export type KnowledgeAnswer = z.infer<typeof knowledgeAnswerSchema>;

export const parseKnowledgeSourceImportInput = (value: unknown): KnowledgeSourceImportInput => knowledgeSourceImportInputSchema.parse(value);
export const parseKnowledgeSource = (value: unknown): KnowledgeSource => knowledgeSourceSchema.parse(value);
export const parseKnowledgeSources = (value: unknown): readonly KnowledgeSource[] => z.array(knowledgeSourceSchema).max(500).parse(value);
export const parseKnowledgeSearchInput = (value: unknown): KnowledgeSearchInput => knowledgeSearchInputSchema.parse(value);
export const parseKnowledgeDisclosurePreparation = (value: unknown): KnowledgeDisclosurePreparation => knowledgeDisclosurePreparationSchema.parse(value);
export const parseKnowledgeSearchResult = (value: unknown): KnowledgeSearchResult => knowledgeSearchResultSchema.parse(value);
export const parseKnowledgeDisclosurePreview = (value: unknown): KnowledgeDisclosurePreview => knowledgeDisclosurePreviewSchema.parse(value);
export const parseKnowledgeDisclosureProposal = (value: unknown): KnowledgeDisclosureProposal => knowledgeDisclosureProposalSchema.parse(value);
export const parseKnowledgeDisclosureApproval = (value: unknown): KnowledgeDisclosureApproval => knowledgeDisclosureApprovalSchema.parse(value);

export function parseKnowledgeAnswerText(text: string, disclosure: KnowledgeDisclosurePreview): KnowledgeAnswer {
  if (text.length > 100_000) throw new Error("Knowledge answer is too large");
  const content = knowledgeAnswerContentSchema.parse(JSON.parse(text) as unknown);
  const disclosed = new Set(disclosure.citations.map(({ chunkId }) => chunkId));
  if (content.citations.some(({ chunkId }) => !disclosed.has(chunkId))) throw new Error("Knowledge answer must cite a disclosed chunk");
  return knowledgeAnswerSchema.parse({ ...content, disclosure });
}
