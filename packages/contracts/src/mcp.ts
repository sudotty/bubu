import { z } from "zod";
import { approvalTokenSchema } from "./aggregate-explanation.js";
import { datasetIdSchema } from "./dataset.js";

const maximumMcpConnections = 20;
const maximumMcpEnvironmentEntries = 20;
const maximumMcpArguments = 50;
const maximumMcpItemsPerPrimitive = 100;
const maximumMcpInputSchemaBytes = 16 * 1024;

const directProcessDeniedNames = new Set([
  "bash", "bunx", "cmd", "cmd.exe", "dash", "fish", "npm", "npm.cmd", "npx", "npx.cmd",
  "pipx", "pnpm", "powershell", "powershell.exe", "pwsh", "pwsh.exe", "sh", "su", "sudo",
  "uvx", "yarn", "zsh",
]);

function isAbsoluteLocalPath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value);
}

function executableName(value: string): string {
  return value.split(/[\\/]/u).at(-1)?.toLocaleLowerCase("en-US") ?? "";
}

const absolutePathSchema = z.string().trim().min(1).max(2_048)
  .refine((value) => !/[\0\r\n]/u.test(value), "Path contains forbidden control characters")
  .refine(isAbsoluteLocalPath, "Path must be absolute");

export const mcpConnectionIdSchema = datasetIdSchema;

export const mcpDirectExecutableSchema = absolutePathSchema
  .refine((value) => !directProcessDeniedNames.has(executableName(value)),
    "MCP executable must not be a shell, privilege escalator, or package runner");

const mcpArgumentSchema = z.string().max(2_000)
  .refine((value) => !/[\0\r\n]/u.test(value), "MCP arguments cannot contain control characters");

export const mcpEnvironmentKeySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/u)
  .refine((value) => !value.startsWith("BUBU_") && value !== "ELECTRON_RUN_AS_NODE",
    "Reserved BuBu and Electron environment keys cannot be passed to MCP servers");

const mcpEnvironmentValueSchema = z.string().min(1).max(8_192)
  .refine((value) => !value.includes("\0"), "MCP environment values cannot contain NUL");

const uniqueEnvironmentKeys = (
  values: readonly { readonly name: string }[],
  context: z.RefinementCtx,
): void => {
  if (new Set(values.map(({ name }) => name)).size !== values.length) {
    context.addIssue({ code: "custom", message: "MCP environment keys must be unique" });
  }
};

const mcpEnvironmentInputSchema = z.object({
  name: mcpEnvironmentKeySchema,
  value: mcpEnvironmentValueSchema.optional(),
}).strict();

export const mcpConnectionConfigurationInputSchema = z.object({
  id: mcpConnectionIdSchema.optional(),
  name: z.string().trim().min(1).max(100),
  command: mcpDirectExecutableSchema,
  args: z.array(mcpArgumentSchema).max(maximumMcpArguments),
  environment: z.array(mcpEnvironmentInputSchema).max(maximumMcpEnvironmentEntries),
}).strict().superRefine((value, context) => uniqueEnvironmentKeys(value.environment, context));

const environmentKeysSchema = z.array(mcpEnvironmentKeySchema).max(maximumMcpEnvironmentEntries)
  .superRefine((value, context) => uniqueEnvironmentKeys(value.map((name) => ({ name })), context));

export const mcpConnectionProfileSchema = z.object({
  id: mcpConnectionIdSchema,
  name: z.string().trim().min(1).max(100),
  transport: z.object({
    kind: z.literal("stdio"),
    command: mcpDirectExecutableSchema,
    args: z.array(mcpArgumentSchema).max(maximumMcpArguments),
    environmentKeys: environmentKeysSchema,
  }).strict(),
}).strict();

export const mcpConnectionRegistryStateSchema = z.object({
  connections: z.array(mcpConnectionProfileSchema).max(maximumMcpConnections),
  encryptionAvailable: z.boolean(),
}).strict().superRefine((value, context) => {
  if (new Set(value.connections.map(({ id }) => id)).size !== value.connections.length) {
    context.addIssue({ code: "custom", message: "MCP connection identifiers must be unique" });
  }
});

export const mcpInspectionBudget = Object.freeze({
  maxDurationMs: 30_000 as const,
  maxPagesPerPrimitive: 5 as const,
  maxItemsPerPrimitive: 100 as const,
  maxResultBytes: 262_144 as const,
});

export const mcpInspectionBudgetSchema = z.object({
  maxDurationMs: z.literal(mcpInspectionBudget.maxDurationMs),
  maxPagesPerPrimitive: z.literal(mcpInspectionBudget.maxPagesPerPrimitive),
  maxItemsPerPrimitive: z.literal(mcpInspectionBudget.maxItemsPerPrimitive),
  maxResultBytes: z.literal(mcpInspectionBudget.maxResultBytes),
}).strict();

const approvedMcpConnectionSchema = z.object({
  id: mcpConnectionIdSchema,
  name: z.string().trim().min(1).max(100),
  command: mcpDirectExecutableSchema,
  args: z.array(mcpArgumentSchema).max(maximumMcpArguments),
  environmentKeys: environmentKeysSchema,
}).strict();

export const mcpInspectionProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  connection: approvedMcpConnectionSchema,
  budget: mcpInspectionBudgetSchema,
  warning: z.literal("untrusted-local-code"),
}).strict();

export const mcpInspectionApprovalSchema = z.object({
  approvalToken: approvalTokenSchema,
}).strict();

export const mcpResolvedEnvironmentSchema = z.record(mcpEnvironmentKeySchema, mcpEnvironmentValueSchema)
  .superRefine((value, context) => {
    if (Object.keys(value).length > maximumMcpEnvironmentEntries) {
      context.addIssue({ code: "custom", message: "MCP environment exceeds its entry budget" });
    }
  });

export const mcpInspectionInvocationSchema = z.object({
  connectionId: mcpConnectionIdSchema,
  command: mcpDirectExecutableSchema,
  args: z.array(mcpArgumentSchema).max(maximumMcpArguments),
  environment: mcpResolvedEnvironmentSchema,
  workingDirectory: absolutePathSchema,
  budget: mcpInspectionBudgetSchema,
}).strict();

const protocolNameSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/u);
const boundedUntrustedText = z.string().max(2_000);
const boundedOptionalText = boundedUntrustedText.optional();
const boundedUriSchema = z.string().min(1).max(2_000).refine(
  (value) => !/[\0\r\n]/u.test(value),
  "MCP URI contains forbidden control characters",
);
const inputSchemaJsonSchema = z.string().min(2).max(maximumMcpInputSchemaBytes).superRefine((value, context) => {
  if (new TextEncoder().encode(value).byteLength > maximumMcpInputSchemaBytes) {
    context.addIssue({ code: "custom", message: "MCP input schema exceeds its byte budget" });
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      context.addIssue({ code: "custom", message: "MCP input schema must encode a JSON object" });
    }
  } catch {
    context.addIssue({ code: "custom", message: "MCP input schema must be valid JSON" });
  }
});

const mcpToolSummarySchema = z.object({
  name: protocolNameSchema,
  title: boundedOptionalText,
  description: boundedOptionalText,
  inputSchemaJson: inputSchemaJsonSchema,
  annotations: z.object({
    readOnlyHint: z.boolean().optional(),
    destructiveHint: z.boolean().optional(),
    idempotentHint: z.boolean().optional(),
    openWorldHint: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const mcpResourceSummarySchema = z.object({
  uri: boundedUriSchema,
  name: z.string().trim().min(1).max(500),
  title: boundedOptionalText,
  description: boundedOptionalText,
  mimeType: z.string().trim().min(1).max(200).optional(),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();

const mcpPromptSummarySchema = z.object({
  name: protocolNameSchema,
  title: boundedOptionalText,
  description: boundedOptionalText,
  arguments: z.array(z.object({
    name: protocolNameSchema,
    description: boundedOptionalText,
    required: z.boolean(),
  }).strict()).max(50),
}).strict();

export const mcpInspectionSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  requestedProtocolVersion: z.literal("2025-11-25"),
  server: z.object({
    name: z.string().trim().min(1).max(200),
    version: z.string().trim().min(1).max(200),
    title: boundedOptionalText,
  }).strict(),
  capabilities: z.object({
    tools: z.boolean(),
    resources: z.boolean(),
    prompts: z.boolean(),
  }).strict(),
  instructions: boundedUntrustedText.nullable(),
  tools: z.array(mcpToolSummarySchema).max(maximumMcpItemsPerPrimitive),
  resources: z.array(mcpResourceSummarySchema).max(maximumMcpItemsPerPrimitive),
  prompts: z.array(mcpPromptSummarySchema).max(maximumMcpItemsPerPrimitive),
  limited: z.boolean(),
  untrustedMetadata: z.literal(true),
}).strict().superRefine((value, context) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > mcpInspectionBudget.maxResultBytes) {
    context.addIssue({ code: "custom", message: "MCP inspection exceeds its result-byte budget" });
  }
  for (const [capability, items] of [
    ["tools", value.tools], ["resources", value.resources], ["prompts", value.prompts],
  ] as const) {
    if (!value.capabilities[capability] && items.length !== 0) {
      context.addIssue({ code: "custom", path: [capability], message: "MCP items require an advertised capability" });
    }
  }
});

export const mcpResourceReadBudget = Object.freeze({
  maxDurationMs: 30_000 as const,
  maxDiscoveryPages: 5 as const,
  maxDiscoveredResources: 100 as const,
  maxContentParts: 20 as const,
  maxDecodedBytes: 262_144 as const,
  maxResultBytes: 393_216 as const,
});

export const mcpResourceReadBudgetSchema = z.object({
  maxDurationMs: z.literal(mcpResourceReadBudget.maxDurationMs),
  maxDiscoveryPages: z.literal(mcpResourceReadBudget.maxDiscoveryPages),
  maxDiscoveredResources: z.literal(mcpResourceReadBudget.maxDiscoveredResources),
  maxContentParts: z.literal(mcpResourceReadBudget.maxContentParts),
  maxDecodedBytes: z.literal(mcpResourceReadBudget.maxDecodedBytes),
  maxResultBytes: z.literal(mcpResourceReadBudget.maxResultBytes),
}).strict();

export const mcpResourceReadRequestSchema = z.object({
  connectionId: mcpConnectionIdSchema,
  resourceUri: boundedUriSchema,
}).strict();

export const mcpResourceReadProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  connection: approvedMcpConnectionSchema,
  resourceUri: boundedUriSchema,
  budget: mcpResourceReadBudgetSchema,
  warning: z.literal("untrusted-local-code-and-content"),
}).strict();

export const mcpResourceReadApprovalSchema = z.object({
  approvalToken: approvalTokenSchema,
}).strict();

export const mcpResourceReadInvocationSchema = z.object({
  connectionId: mcpConnectionIdSchema,
  command: mcpDirectExecutableSchema,
  args: z.array(mcpArgumentSchema).max(maximumMcpArguments),
  environment: mcpResolvedEnvironmentSchema,
  workingDirectory: absolutePathSchema,
  resourceUri: boundedUriSchema,
  budget: mcpResourceReadBudgetSchema,
}).strict();

const resourceMimeTypeSchema = z.string().trim().min(1).max(200);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const resourceTextContentSchema = z.object({
  kind: z.literal("text"),
  uri: boundedUriSchema,
  mimeType: resourceMimeTypeSchema.optional(),
  text: z.string().max(mcpResourceReadBudget.maxDecodedBytes),
  decodedBytes: z.number().int().nonnegative().max(mcpResourceReadBudget.maxDecodedBytes),
}).strict().superRefine((value, context) => {
  if (new TextEncoder().encode(value.text).byteLength !== value.decodedBytes) {
    context.addIssue({ code: "custom", path: ["decodedBytes"], message: "MCP text decoded-byte count is invalid" });
  }
});
const resourceBlobMetadataSchema = z.object({
  kind: z.literal("blob"),
  uri: boundedUriSchema,
  mimeType: resourceMimeTypeSchema.optional(),
  decodedBytes: z.number().int().nonnegative().max(mcpResourceReadBudget.maxDecodedBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

export const mcpResourceReadResultSchema = z.object({
  schemaVersion: z.literal(1),
  connectionId: mcpConnectionIdSchema,
  requestedUri: boundedUriSchema,
  contents: z.array(z.discriminatedUnion("kind", [resourceTextContentSchema, resourceBlobMetadataSchema]))
    .max(mcpResourceReadBudget.maxContentParts),
  decodedBytes: z.number().int().nonnegative().max(mcpResourceReadBudget.maxDecodedBytes),
  localOnly: z.literal(true),
  untrustedContent: z.literal(true),
}).strict().superRefine((value, context) => {
  const decodedBytes = value.contents.reduce((total, content) => total + content.decodedBytes, 0);
  if (decodedBytes !== value.decodedBytes || decodedBytes > mcpResourceReadBudget.maxDecodedBytes) {
    context.addIssue({ code: "custom", path: ["decodedBytes"], message: "MCP resource exceeds its decoded-content budget" });
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > mcpResourceReadBudget.maxResultBytes) {
    context.addIssue({ code: "custom", message: "MCP resource result exceeds its serialized-byte budget" });
  }
});

const maximumMcpPromptArguments = 20;
const maximumMcpPromptArgumentBytes = 4_096;
const maximumMcpPromptArgumentsBytes = 16_384;

export const mcpPromptGetBudget = Object.freeze({
  maxDurationMs: 30_000 as const,
  maxDiscoveryPages: 5 as const,
  maxDiscoveredPrompts: 100 as const,
  maxMessages: 20 as const,
  maxDecodedBytes: 262_144 as const,
  maxResultBytes: 393_216 as const,
});

export const mcpPromptGetBudgetSchema = z.object({
  maxDurationMs: z.literal(mcpPromptGetBudget.maxDurationMs),
  maxDiscoveryPages: z.literal(mcpPromptGetBudget.maxDiscoveryPages),
  maxDiscoveredPrompts: z.literal(mcpPromptGetBudget.maxDiscoveredPrompts),
  maxMessages: z.literal(mcpPromptGetBudget.maxMessages),
  maxDecodedBytes: z.literal(mcpPromptGetBudget.maxDecodedBytes),
  maxResultBytes: z.literal(mcpPromptGetBudget.maxResultBytes),
}).strict();

const mcpPromptArgumentValueSchema = z.string().max(maximumMcpPromptArgumentBytes).superRefine((value, context) => {
  if (new TextEncoder().encode(value).byteLength > maximumMcpPromptArgumentBytes) {
    context.addIssue({ code: "custom", message: "MCP prompt argument exceeds its byte budget" });
  }
});
const mcpPromptArgumentValuesSchema = z.array(z.object({
  name: protocolNameSchema,
  value: mcpPromptArgumentValueSchema,
}).strict()).max(maximumMcpPromptArguments).superRefine((values, context) => {
  if (new Set(values.map(({ name }) => name)).size !== values.length) {
    context.addIssue({ code: "custom", message: "MCP prompt argument names must be unique" });
  }
  const payload = Object.fromEntries(values.map(({ name, value }) => [name, value]));
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > maximumMcpPromptArgumentsBytes) {
    context.addIssue({ code: "custom", message: "MCP prompt arguments exceed their combined byte budget" });
  }
});

export const mcpPromptGetRequestSchema = z.object({
  connectionId: mcpConnectionIdSchema,
  promptName: protocolNameSchema,
  arguments: mcpPromptArgumentValuesSchema,
}).strict();
export const mcpPromptGetProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  connection: approvedMcpConnectionSchema,
  promptName: protocolNameSchema,
  arguments: mcpPromptArgumentValuesSchema,
  budget: mcpPromptGetBudgetSchema,
  warning: z.literal("untrusted-local-code-argument-disclosure-and-content"),
}).strict();
export const mcpPromptGetApprovalSchema = z.object({
  approvalToken: approvalTokenSchema,
  request: mcpPromptGetRequestSchema,
}).strict();
export const mcpPromptGetInvocationSchema = z.object({
  connectionId: mcpConnectionIdSchema,
  command: mcpDirectExecutableSchema,
  args: z.array(mcpArgumentSchema).max(maximumMcpArguments),
  environment: mcpResolvedEnvironmentSchema,
  workingDirectory: absolutePathSchema,
  promptName: protocolNameSchema,
  arguments: mcpPromptArgumentValuesSchema,
  budget: mcpPromptGetBudgetSchema,
}).strict();

const promptTextContentSchema = z.object({
  kind: z.literal("text"),
  text: z.string().max(mcpPromptGetBudget.maxDecodedBytes),
  decodedBytes: z.number().int().nonnegative().max(mcpPromptGetBudget.maxDecodedBytes),
}).strict().superRefine((value, context) => {
  if (new TextEncoder().encode(value.text).byteLength !== value.decodedBytes) {
    context.addIssue({ code: "custom", path: ["decodedBytes"], message: "MCP prompt text decoded-byte count is invalid" });
  }
});
const promptImageMetadataSchema = z.object({
  kind: z.literal("image"),
  mimeType: resourceMimeTypeSchema,
  decodedBytes: z.number().int().nonnegative().max(mcpPromptGetBudget.maxDecodedBytes),
  sha256: sha256Schema,
}).strict();
const promptAudioMetadataSchema = z.object({
  kind: z.literal("audio"),
  mimeType: resourceMimeTypeSchema,
  decodedBytes: z.number().int().nonnegative().max(mcpPromptGetBudget.maxDecodedBytes),
  sha256: sha256Schema,
}).strict();
const promptEmbeddedTextSchema = z.object({
  kind: z.literal("embedded-text"),
  uri: boundedUriSchema,
  mimeType: resourceMimeTypeSchema.optional(),
  text: z.string().max(mcpPromptGetBudget.maxDecodedBytes),
  decodedBytes: z.number().int().nonnegative().max(mcpPromptGetBudget.maxDecodedBytes),
}).strict().superRefine((value, context) => {
  if (new TextEncoder().encode(value.text).byteLength !== value.decodedBytes) {
    context.addIssue({ code: "custom", path: ["decodedBytes"], message: "MCP embedded text decoded-byte count is invalid" });
  }
});
const promptEmbeddedBlobSchema = z.object({
  kind: z.literal("embedded-blob"),
  uri: boundedUriSchema,
  mimeType: resourceMimeTypeSchema.optional(),
  decodedBytes: z.number().int().nonnegative().max(mcpPromptGetBudget.maxDecodedBytes),
  sha256: sha256Schema,
}).strict();
const promptResourceLinkSchema = z.object({
  kind: z.literal("resource-link"),
  uri: boundedUriSchema,
  name: z.string().trim().min(1).max(500),
  title: boundedOptionalText,
  description: boundedOptionalText,
  mimeType: resourceMimeTypeSchema.optional(),
  size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  decodedBytes: z.literal(0),
}).strict();
const mcpPromptMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.discriminatedUnion("kind", [
    promptTextContentSchema,
    promptImageMetadataSchema,
    promptAudioMetadataSchema,
    promptEmbeddedTextSchema,
    promptEmbeddedBlobSchema,
    promptResourceLinkSchema,
  ]),
}).strict();

export const mcpPromptGetResultSchema = z.object({
  schemaVersion: z.literal(1),
  connectionId: mcpConnectionIdSchema,
  promptName: protocolNameSchema,
  description: boundedOptionalText,
  messages: z.array(mcpPromptMessageSchema).max(mcpPromptGetBudget.maxMessages),
  decodedBytes: z.number().int().nonnegative().max(mcpPromptGetBudget.maxDecodedBytes),
  localOnly: z.literal(true),
  untrustedContent: z.literal(true),
}).strict().superRefine((value, context) => {
  const decodedBytes = value.messages.reduce((total, message) => total + message.content.decodedBytes, 0);
  if (decodedBytes !== value.decodedBytes || decodedBytes > mcpPromptGetBudget.maxDecodedBytes) {
    context.addIssue({ code: "custom", path: ["decodedBytes"], message: "MCP prompt exceeds its decoded-content budget" });
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > mcpPromptGetBudget.maxResultBytes) {
    context.addIssue({ code: "custom", message: "MCP prompt result exceeds its serialized-byte budget" });
  }
});

const mcpAuditIdSchema = z.string().uuid();
const mcpAuditErrorCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/u);

const mcpAuditStartBaseSchema = z.object({
  auditId: mcpAuditIdSchema,
  connectionId: mcpConnectionIdSchema,
  connectionName: z.string().trim().min(1).max(100),
  requestFingerprint: sha256Schema,
  startedAt: z.string().datetime({ offset: true }),
});
const mcpResourceAuditStartSchema = mcpAuditStartBaseSchema.extend({
  operation: z.literal("resource-read"),
  resourceUri: boundedUriSchema,
}).strict();
const mcpPromptAuditStartSchema = mcpAuditStartBaseSchema.extend({
  operation: z.literal("prompt-get"),
  promptName: protocolNameSchema,
  argumentKeys: z.array(protocolNameSchema).max(maximumMcpPromptArguments).superRefine((values, context) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "MCP audit argument keys must be unique" });
  }),
  argumentBytes: z.number().int().nonnegative().max(maximumMcpPromptArgumentsBytes),
}).strict();
export const mcpAuditStartSchema = z.discriminatedUnion("operation", [
  mcpResourceAuditStartSchema,
  mcpPromptAuditStartSchema,
]);

const mcpAuditSuccessOutcomeSchema = z.object({
  auditId: mcpAuditIdSchema,
  status: z.literal("succeeded"),
  completedAt: z.string().datetime({ offset: true }),
  contentParts: z.number().int().nonnegative().max(mcpResourceReadBudget.maxContentParts),
  decodedBytes: z.number().int().nonnegative().max(mcpResourceReadBudget.maxDecodedBytes),
}).strict();
const mcpAuditFailureOutcomeSchema = z.object({
  auditId: mcpAuditIdSchema,
  status: z.literal("failed"),
  completedAt: z.string().datetime({ offset: true }),
  errorCode: mcpAuditErrorCodeSchema,
}).strict();
export const mcpAuditOutcomeSchema = z.discriminatedUnion("status", [
  mcpAuditSuccessOutcomeSchema,
  mcpAuditFailureOutcomeSchema,
]);

const auditSucceededFields = {
  status: z.literal("succeeded"),
  completedAt: z.string().datetime({ offset: true }),
  contentParts: z.number().int().nonnegative().max(mcpResourceReadBudget.maxContentParts),
  decodedBytes: z.number().int().nonnegative().max(mcpResourceReadBudget.maxDecodedBytes),
} as const;
const auditFailedFields = {
  status: z.literal("failed"),
  completedAt: z.string().datetime({ offset: true }),
  errorCode: mcpAuditErrorCodeSchema,
} as const;
const auditInterruptedFields = { status: z.literal("interrupted") } as const;
const auditInProgressFields = { status: z.literal("in-progress") } as const;
export const mcpAuditEventSchema = z.union([
  mcpResourceAuditStartSchema.extend(auditSucceededFields).strict(),
  mcpResourceAuditStartSchema.extend(auditFailedFields).strict(),
  mcpResourceAuditStartSchema.extend(auditInterruptedFields).strict(),
  mcpResourceAuditStartSchema.extend(auditInProgressFields).strict(),
  mcpPromptAuditStartSchema.extend(auditSucceededFields).strict(),
  mcpPromptAuditStartSchema.extend(auditFailedFields).strict(),
  mcpPromptAuditStartSchema.extend(auditInterruptedFields).strict(),
  mcpPromptAuditStartSchema.extend(auditInProgressFields).strict(),
]);
export const mcpAuditEventsSchema = z.array(mcpAuditEventSchema).max(100).superRefine((events, context) => {
  if (new Set(events.map(({ auditId }) => auditId)).size !== events.length) {
    context.addIssue({ code: "custom", message: "MCP audit identifiers must be unique" });
  }
});

export type McpConnectionId = z.infer<typeof mcpConnectionIdSchema>;
export type McpConnectionConfigurationInput = z.infer<typeof mcpConnectionConfigurationInputSchema>;
export type McpConnectionProfile = z.infer<typeof mcpConnectionProfileSchema>;
export type McpConnectionRegistryState = z.infer<typeof mcpConnectionRegistryStateSchema>;
export type McpInspectionProposal = z.infer<typeof mcpInspectionProposalSchema>;
export type McpInspectionApproval = z.infer<typeof mcpInspectionApprovalSchema>;
export type McpInspectionInvocation = z.infer<typeof mcpInspectionInvocationSchema>;
export type McpInspectionSnapshot = z.infer<typeof mcpInspectionSnapshotSchema>;
export type McpResolvedEnvironment = z.infer<typeof mcpResolvedEnvironmentSchema>;
export type McpResourceReadRequest = z.infer<typeof mcpResourceReadRequestSchema>;
export type McpResourceReadProposal = z.infer<typeof mcpResourceReadProposalSchema>;
export type McpResourceReadApproval = z.infer<typeof mcpResourceReadApprovalSchema>;
export type McpResourceReadInvocation = z.infer<typeof mcpResourceReadInvocationSchema>;
export type McpResourceReadResult = z.infer<typeof mcpResourceReadResultSchema>;
export type McpPromptGetRequest = z.infer<typeof mcpPromptGetRequestSchema>;
export type McpPromptGetProposal = z.infer<typeof mcpPromptGetProposalSchema>;
export type McpPromptGetApproval = z.infer<typeof mcpPromptGetApprovalSchema>;
export type McpPromptGetInvocation = z.infer<typeof mcpPromptGetInvocationSchema>;
export type McpPromptGetResult = z.infer<typeof mcpPromptGetResultSchema>;
export type McpAuditStart = z.infer<typeof mcpAuditStartSchema>;
export type McpAuditOutcome = z.infer<typeof mcpAuditOutcomeSchema>;
export type McpAuditEvent = z.infer<typeof mcpAuditEventSchema>;

export function parseMcpConnectionId(value: unknown): McpConnectionId {
  return mcpConnectionIdSchema.parse(value);
}

export function parseMcpConnectionConfigurationInput(value: unknown): McpConnectionConfigurationInput {
  return mcpConnectionConfigurationInputSchema.parse(value);
}

export function parseMcpResourceReadRequest(value: unknown): McpResourceReadRequest {
  return mcpResourceReadRequestSchema.parse(value);
}

export function parseMcpResourceReadProposal(value: unknown): McpResourceReadProposal {
  return mcpResourceReadProposalSchema.parse(value);
}

export function parseMcpResourceReadApproval(value: unknown): McpResourceReadApproval {
  return mcpResourceReadApprovalSchema.parse(value);
}

export function parseMcpResourceReadInvocation(value: unknown): McpResourceReadInvocation {
  return mcpResourceReadInvocationSchema.parse(value);
}

export function parseMcpResourceReadResult(value: unknown): McpResourceReadResult {
  return mcpResourceReadResultSchema.parse(value);
}

export function parseMcpPromptGetRequest(value: unknown): McpPromptGetRequest {
  return mcpPromptGetRequestSchema.parse(value);
}

export function parseMcpPromptGetProposal(value: unknown): McpPromptGetProposal {
  return mcpPromptGetProposalSchema.parse(value);
}

export function parseMcpPromptGetApproval(value: unknown): McpPromptGetApproval {
  return mcpPromptGetApprovalSchema.parse(value);
}

export function parseMcpPromptGetInvocation(value: unknown): McpPromptGetInvocation {
  return mcpPromptGetInvocationSchema.parse(value);
}

export function parseMcpPromptGetResult(value: unknown): McpPromptGetResult {
  return mcpPromptGetResultSchema.parse(value);
}

export function parseMcpAuditStart(value: unknown): McpAuditStart {
  return mcpAuditStartSchema.parse(value);
}

export function parseMcpAuditOutcome(value: unknown): McpAuditOutcome {
  return mcpAuditOutcomeSchema.parse(value);
}

export function parseMcpAuditEvents(value: unknown): readonly McpAuditEvent[] {
  return mcpAuditEventsSchema.parse(value);
}

export function parseMcpConnectionProfile(value: unknown): McpConnectionProfile {
  return mcpConnectionProfileSchema.parse(value);
}

export function parseMcpConnectionRegistryState(value: unknown): McpConnectionRegistryState {
  return mcpConnectionRegistryStateSchema.parse(value);
}

export function parseMcpInspectionProposal(value: unknown): McpInspectionProposal {
  return mcpInspectionProposalSchema.parse(value);
}

export function parseMcpInspectionApproval(value: unknown): McpInspectionApproval {
  return mcpInspectionApprovalSchema.parse(value);
}

export function parseMcpInspectionInvocation(value: unknown): McpInspectionInvocation {
  return mcpInspectionInvocationSchema.parse(value);
}

export function parseMcpResolvedEnvironment(value: unknown): McpResolvedEnvironment {
  return mcpResolvedEnvironmentSchema.parse(value);
}

export function parseMcpInspectionSnapshot(value: unknown): McpInspectionSnapshot {
  return mcpInspectionSnapshotSchema.parse(value);
}
