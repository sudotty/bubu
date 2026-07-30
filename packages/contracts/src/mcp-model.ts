import { z } from "zod";
import { approvalTokenSchema, modelDestinationSchema } from "./aggregate-explanation.js";
import { datasetIdSchema } from "./dataset.js";
import {
  canonicalMcpJson,
  mcpPromptGetResultSchema,
  mcpToolCallProposalSchema,
  mcpToolSummarySchema,
} from "./mcp.js";
import { validateMcpToolArguments } from "./mcp-tool-schema-validator.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const maximumModelMcpBytes = 64 * 1024;

export const mcpPromptModelPreparationSchema = z.object({
  purpose: z.string().trim().min(1).max(500),
  prompt: mcpPromptGetResultSchema,
}).strict().superRefine((value, context) => {
  if (value.prompt.decodedBytes > maximumModelMcpBytes || new TextEncoder().encode(JSON.stringify(value.prompt)).byteLength > 96 * 1024) {
    context.addIssue({ code: "custom", message: "MCP prompt exceeds the model disclosure budget" });
  }
});

export const mcpPromptModelProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  destination: modelDestinationSchema,
  preparation: mcpPromptModelPreparationSchema,
  payloadBytes: z.number().int().min(1).max(128 * 1024),
  payloadSha256: sha256Schema,
  warning: z.literal("untrusted-mcp-prompt-to-model"),
}).strict();

export const mcpPromptModelApprovalSchema = z.object({ approvalToken: approvalTokenSchema }).strict();

const mcpPromptModelAnswerContentSchema = z.object({
  schemaVersion: z.literal(1),
  response: z.string().trim().min(1).max(8_000),
}).strict();

export const mcpPromptModelAnswerSchema = mcpPromptModelAnswerContentSchema.extend({
  disclosure: z.object({
    connectionId: datasetIdSchema,
    promptName: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/u),
    purpose: z.string().trim().min(1).max(500),
    payloadBytes: z.number().int().min(1).max(128 * 1024),
    payloadSha256: sha256Schema,
  }).strict(),
}).strict();

export const mcpModelToolPreparationSchema = z.object({
  connectionId: datasetIdSchema,
  connectionName: z.string().trim().min(1).max(100),
  goal: z.string().trim().min(1).max(1_000),
  tools: z.array(mcpToolSummarySchema).min(1).max(20),
}).strict().superRefine((value, context) => {
  if (new Set(value.tools.map(({ name }) => name)).size !== value.tools.length) context.addIssue({ code: "custom", message: "Model-visible MCP tool names must be unique" });
  if (value.tools.some(({ taskSupport }) => taskSupport === "required")) context.addIssue({ code: "custom", message: "MCP tools requiring Tasks cannot enter the one-call model path" });
  if (new TextEncoder().encode(canonicalMcpJson(value.tools)).byteLength > maximumModelMcpBytes) context.addIssue({ code: "custom", message: "MCP tool catalog exceeds the model disclosure budget" });
});

export const mcpModelToolProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  destination: modelDestinationSchema,
  preparation: mcpModelToolPreparationSchema,
  payloadBytes: z.number().int().min(1).max(128 * 1024),
  payloadSha256: sha256Schema,
  warning: z.literal("untrusted-tool-metadata-to-model"),
}).strict();

export const mcpModelToolApprovalSchema = z.object({ approvalToken: approvalTokenSchema }).strict();

const mcpModelToolSuggestionSchema = z.object({
  schemaVersion: z.literal(1),
  toolName: z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/u),
  arguments: z.record(z.string(), z.unknown()),
}).strict();

export const mcpModelToolExecutionProposalSchema = mcpToolCallProposalSchema.extend({
  proposedByModel: z.literal(true),
  modelDestination: modelDestinationSchema,
  goalSha256: sha256Schema,
}).strict();

export type McpPromptModelPreparation = z.infer<typeof mcpPromptModelPreparationSchema>;
export type McpPromptModelProposal = z.infer<typeof mcpPromptModelProposalSchema>;
export type McpPromptModelApproval = z.infer<typeof mcpPromptModelApprovalSchema>;
export type McpPromptModelAnswer = z.infer<typeof mcpPromptModelAnswerSchema>;
export type McpModelToolPreparation = z.infer<typeof mcpModelToolPreparationSchema>;
export type McpModelToolProposal = z.infer<typeof mcpModelToolProposalSchema>;
export type McpModelToolApproval = z.infer<typeof mcpModelToolApprovalSchema>;
export type McpModelToolSuggestion = z.infer<typeof mcpModelToolSuggestionSchema>;
export type McpModelToolExecutionProposal = z.infer<typeof mcpModelToolExecutionProposalSchema>;

export const parseMcpPromptModelPreparation = (value: unknown): McpPromptModelPreparation => mcpPromptModelPreparationSchema.parse(value);
export const parseMcpPromptModelProposal = (value: unknown): McpPromptModelProposal => mcpPromptModelProposalSchema.parse(value);
export const parseMcpPromptModelApproval = (value: unknown): McpPromptModelApproval => mcpPromptModelApprovalSchema.parse(value);
export const parseMcpModelToolPreparation = (value: unknown): McpModelToolPreparation => mcpModelToolPreparationSchema.parse(value);
export const parseMcpModelToolProposal = (value: unknown): McpModelToolProposal => mcpModelToolProposalSchema.parse(value);
export const parseMcpModelToolApproval = (value: unknown): McpModelToolApproval => mcpModelToolApprovalSchema.parse(value);
export const parseMcpModelToolExecutionProposal = (value: unknown): McpModelToolExecutionProposal => mcpModelToolExecutionProposalSchema.parse(value);

export function parseMcpPromptModelAnswerText(text: string, proposal: McpPromptModelProposal): McpPromptModelAnswer {
  if (text.length > 100_000) throw new Error("MCP prompt model answer is too large");
  const content = mcpPromptModelAnswerContentSchema.parse(JSON.parse(text) as unknown);
  return mcpPromptModelAnswerSchema.parse({ ...content, disclosure: { connectionId: proposal.preparation.prompt.connectionId, promptName: proposal.preparation.prompt.promptName, purpose: proposal.preparation.purpose, payloadBytes: proposal.payloadBytes, payloadSha256: proposal.payloadSha256 } });
}

export function parseMcpModelToolSuggestionText(text: string, preparation: McpModelToolPreparation): McpModelToolSuggestion {
  if (text.length > 100_000) throw new Error("MCP model tool suggestion is too large");
  const suggestion = mcpModelToolSuggestionSchema.parse(JSON.parse(text) as unknown);
  const tool = preparation.tools.find(({ name }) => name === suggestion.toolName);
  if (!tool) throw new Error("Model proposed an undisclosed MCP tool");
  validateMcpToolArguments(tool.inputSchemaJson, suggestion.arguments);
  return suggestion;
}
