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

export type McpConnectionId = z.infer<typeof mcpConnectionIdSchema>;
export type McpConnectionConfigurationInput = z.infer<typeof mcpConnectionConfigurationInputSchema>;
export type McpConnectionProfile = z.infer<typeof mcpConnectionProfileSchema>;
export type McpConnectionRegistryState = z.infer<typeof mcpConnectionRegistryStateSchema>;
export type McpInspectionProposal = z.infer<typeof mcpInspectionProposalSchema>;
export type McpInspectionApproval = z.infer<typeof mcpInspectionApprovalSchema>;
export type McpInspectionInvocation = z.infer<typeof mcpInspectionInvocationSchema>;
export type McpInspectionSnapshot = z.infer<typeof mcpInspectionSnapshotSchema>;
export type McpResolvedEnvironment = z.infer<typeof mcpResolvedEnvironmentSchema>;

export function parseMcpConnectionId(value: unknown): McpConnectionId {
  return mcpConnectionIdSchema.parse(value);
}

export function parseMcpConnectionConfigurationInput(value: unknown): McpConnectionConfigurationInput {
  return mcpConnectionConfigurationInputSchema.parse(value);
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
