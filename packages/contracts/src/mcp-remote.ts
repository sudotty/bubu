import { z } from "zod";
import { approvalTokenSchema } from "./aggregate-explanation.js";
import { datasetIdSchema } from "./dataset.js";
import { mcpInspectionBudgetSchema, mcpToolCallBudgetSchema, mcpToolCallRequestSchema } from "./mcp.js";

const httpsUrlSchema = z.string().url().max(2_048).superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:") context.addIssue({ code: "custom", message: "Remote MCP URLs must use HTTPS" });
  if (url.username || url.password) context.addIssue({ code: "custom", message: "Remote MCP URLs cannot contain credentials" });
  if (url.hash) context.addIssue({ code: "custom", message: "Remote MCP URLs cannot contain fragments" });
});
const scopeSchema = z.string().regex(/^[\x21\x23-\x5B\x5D-\x7E]{1,200}$/u);
const oauthConfigurationSchema = z.object({
  kind: z.literal("oauth-pkce"),
  authorizationEndpoint: httpsUrlSchema,
  tokenEndpoint: httpsUrlSchema,
  clientId: z.string().trim().min(1).max(500),
  scopes: z.array(scopeSchema).max(20).superRefine((value, context) => {
    if (new Set(value).size !== value.length) context.addIssue({ code: "custom", message: "OAuth scopes must be unique" });
  }),
}).strict();

export const remoteMcpConnectionConfigurationInputSchema = z.object({
  id: datasetIdSchema.optional(),
  name: z.string().trim().min(1).max(100),
  serverUrl: httpsUrlSchema,
  authorization: z.discriminatedUnion("kind", [z.object({ kind: z.literal("none") }).strict(), oauthConfigurationSchema]),
}).strict();

export const remoteMcpConnectionProfileSchema = z.object({
  id: datasetIdSchema,
  name: z.string().trim().min(1).max(100),
  serverUrl: httpsUrlSchema,
  authorization: z.discriminatedUnion("kind", [z.object({ kind: z.literal("none") }).strict(), oauthConfigurationSchema]),
  authorizationStatus: z.enum(["not-required", "disconnected", "connected", "expired"]),
}).strict().superRefine((value, context) => {
  if ((value.authorization.kind === "none") !== (value.authorizationStatus === "not-required")) context.addIssue({ code: "custom", message: "Remote MCP authorization status is inconsistent" });
});

export const remoteMcpRegistryStateSchema = z.object({ connections: z.array(remoteMcpConnectionProfileSchema).max(20), encryptionAvailable: z.boolean() }).strict();

export const remoteMcpOAuthStartProposalSchema = z.object({
  connectionId: datasetIdSchema,
  authorizationUrl: httpsUrlSchema,
  redirectUrl: z.string().url().refine((value) => new URL(value).hostname === "127.0.0.1", "OAuth redirect must use the owned loopback listener"),
  state: z.string().regex(/^[a-f0-9]{64}$/u),
  expiresAt: z.string().datetime({ offset: true }),
  warning: z.literal("external-browser-oauth-pkce"),
}).strict();

export const remoteMcpOAuthCallbackSchema = z.object({ connectionId: datasetIdSchema, state: z.string().regex(/^[a-f0-9]{64}$/u), code: z.string().min(1).max(8_192) }).strict();
export const remoteMcpOAuthApprovalSchema = z.object({ connectionId: datasetIdSchema, state: z.string().regex(/^[a-f0-9]{64}$/u) }).strict();

export const remoteMcpInspectionProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  connection: remoteMcpConnectionProfileSchema,
  budget: mcpInspectionBudgetSchema,
  warning: z.literal("remote-untrusted-network-service"),
}).strict();
export const remoteMcpInspectionApprovalSchema = z.object({ approvalToken: approvalTokenSchema }).strict();

const bearerSchema = z.string().min(1).max(16_384).refine((value) => !/[\0\r\n]/u.test(value), "Bearer token contains control characters");
const resolvedAddressesSchema = z.array(z.union([z.ipv4(), z.ipv6()])).min(1).max(16);
export const remoteMcpInspectionInvocationSchema = z.object({
  connectionId: datasetIdSchema,
  serverUrl: httpsUrlSchema,
  resolvedAddresses: resolvedAddressesSchema,
  authorizationBearer: bearerSchema.optional(),
  budget: mcpInspectionBudgetSchema,
}).strict();

export const remoteMcpToolCallProposalSchema = z.object({
  approvalToken: approvalTokenSchema,
  expiresAt: z.string().datetime({ offset: true }),
  connection: remoteMcpConnectionProfileSchema,
  request: mcpToolCallRequestSchema,
  budget: mcpToolCallBudgetSchema,
  warning: z.literal("remote-untrusted-tool-and-side-effects"),
}).strict();
export const remoteMcpToolCallApprovalSchema = z.object({ approvalToken: approvalTokenSchema, request: mcpToolCallRequestSchema }).strict();
export const remoteMcpToolCallInvocationSchema = z.object({
  connectionId: datasetIdSchema,
  serverUrl: httpsUrlSchema,
  resolvedAddresses: resolvedAddressesSchema,
  authorizationBearer: bearerSchema.optional(),
  toolName: mcpToolCallRequestSchema.shape.toolName,
  inputSchemaSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  taskSupport: mcpToolCallRequestSchema.shape.taskSupport,
  arguments: mcpToolCallRequestSchema.shape.arguments,
  budget: mcpToolCallBudgetSchema,
}).strict();

const remoteAuditBaseSchema = z.object({ auditId: z.string().uuid(), connectionId: datasetIdSchema, connectionName: z.string().trim().min(1).max(100), endpointOrigin: httpsUrlSchema.refine((value) => new URL(value).pathname === "/" && !new URL(value).search, "Audit endpoint must be an origin"), requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/u), startedAt: z.string().datetime({ offset: true }) });
const remoteInspectionAuditStartSchema = remoteAuditBaseSchema.extend({ operation: z.literal("remote-inspect") }).strict();
const remoteToolAuditStartSchema = remoteAuditBaseSchema.extend({ operation: z.literal("remote-tool-call"), toolName: mcpToolCallRequestSchema.shape.toolName, inputSchemaSha256: z.string().regex(/^[a-f0-9]{64}$/u), inputKeys: z.array(z.string().min(1).max(256)).max(100), inputBytes: z.number().int().nonnegative().max(32_768) }).strict();
export const remoteMcpAuditStartSchema = z.discriminatedUnion("operation", [remoteInspectionAuditStartSchema, remoteToolAuditStartSchema]);
const remoteAuditSuccessFields = { status: z.literal("succeeded"), completedAt: z.string().datetime({ offset: true }), contentParts: z.number().int().nonnegative().max(300), decodedBytes: z.number().int().nonnegative().max(393_216) } as const;
const remoteAuditFailureFields = { status: z.literal("failed"), completedAt: z.string().datetime({ offset: true }), errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/u) } as const;
export const remoteMcpAuditOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ auditId: z.string().uuid(), ...remoteAuditSuccessFields }).strict(),
  z.object({ auditId: z.string().uuid(), ...remoteAuditFailureFields }).strict(),
]);
export const remoteMcpAuditEventSchema = z.union([
  remoteInspectionAuditStartSchema.extend({ status: z.literal("in-progress") }).strict(), remoteInspectionAuditStartSchema.extend({ status: z.literal("interrupted") }).strict(),
  remoteInspectionAuditStartSchema.extend(remoteAuditSuccessFields).strict(), remoteInspectionAuditStartSchema.extend(remoteAuditFailureFields).strict(),
  remoteToolAuditStartSchema.extend({ status: z.literal("in-progress") }).strict(), remoteToolAuditStartSchema.extend({ status: z.literal("interrupted") }).strict(),
  remoteToolAuditStartSchema.extend(remoteAuditSuccessFields).strict(), remoteToolAuditStartSchema.extend(remoteAuditFailureFields).strict(),
]);
export const remoteMcpAuditEventsSchema = z.array(remoteMcpAuditEventSchema).max(100);

export type RemoteMcpConnectionConfigurationInput = z.infer<typeof remoteMcpConnectionConfigurationInputSchema>;
export type RemoteMcpConnectionProfile = z.infer<typeof remoteMcpConnectionProfileSchema>;
export type RemoteMcpRegistryState = z.infer<typeof remoteMcpRegistryStateSchema>;
export type RemoteMcpOAuthStartProposal = z.infer<typeof remoteMcpOAuthStartProposalSchema>;
export type RemoteMcpOAuthCallback = z.infer<typeof remoteMcpOAuthCallbackSchema>;
export type RemoteMcpOAuthApproval = z.infer<typeof remoteMcpOAuthApprovalSchema>;
export type RemoteMcpInspectionProposal = z.infer<typeof remoteMcpInspectionProposalSchema>;
export type RemoteMcpInspectionApproval = z.infer<typeof remoteMcpInspectionApprovalSchema>;
export type RemoteMcpInspectionInvocation = z.infer<typeof remoteMcpInspectionInvocationSchema>;
export type RemoteMcpToolCallProposal = z.infer<typeof remoteMcpToolCallProposalSchema>;
export type RemoteMcpToolCallApproval = z.infer<typeof remoteMcpToolCallApprovalSchema>;
export type RemoteMcpToolCallInvocation = z.infer<typeof remoteMcpToolCallInvocationSchema>;
export type RemoteMcpAuditStart = z.infer<typeof remoteMcpAuditStartSchema>;
export type RemoteMcpAuditOutcome = z.infer<typeof remoteMcpAuditOutcomeSchema>;
export type RemoteMcpAuditEvent = z.infer<typeof remoteMcpAuditEventSchema>;

export const parseRemoteMcpConnectionConfigurationInput = (value: unknown): RemoteMcpConnectionConfigurationInput => remoteMcpConnectionConfigurationInputSchema.parse(value);
export const parseRemoteMcpConnectionProfile = (value: unknown): RemoteMcpConnectionProfile => remoteMcpConnectionProfileSchema.parse(value);
export const parseRemoteMcpRegistryState = (value: unknown): RemoteMcpRegistryState => remoteMcpRegistryStateSchema.parse(value);
export const parseRemoteMcpOAuthStartProposal = (value: unknown): RemoteMcpOAuthStartProposal => remoteMcpOAuthStartProposalSchema.parse(value);
export const parseRemoteMcpOAuthCallback = (value: unknown): RemoteMcpOAuthCallback => remoteMcpOAuthCallbackSchema.parse(value);
export const parseRemoteMcpOAuthApproval = (value: unknown): RemoteMcpOAuthApproval => remoteMcpOAuthApprovalSchema.parse(value);
export const parseRemoteMcpInspectionProposal = (value: unknown): RemoteMcpInspectionProposal => remoteMcpInspectionProposalSchema.parse(value);
export const parseRemoteMcpInspectionApproval = (value: unknown): RemoteMcpInspectionApproval => remoteMcpInspectionApprovalSchema.parse(value);
export const parseRemoteMcpInspectionInvocation = (value: unknown): RemoteMcpInspectionInvocation => remoteMcpInspectionInvocationSchema.parse(value);
export const parseRemoteMcpToolCallProposal = (value: unknown): RemoteMcpToolCallProposal => remoteMcpToolCallProposalSchema.parse(value);
export const parseRemoteMcpToolCallApproval = (value: unknown): RemoteMcpToolCallApproval => remoteMcpToolCallApprovalSchema.parse(value);
export const parseRemoteMcpToolCallInvocation = (value: unknown): RemoteMcpToolCallInvocation => remoteMcpToolCallInvocationSchema.parse(value);
export const parseRemoteMcpAuditStart = (value: unknown): RemoteMcpAuditStart => remoteMcpAuditStartSchema.parse(value);
export const parseRemoteMcpAuditOutcome = (value: unknown): RemoteMcpAuditOutcome => remoteMcpAuditOutcomeSchema.parse(value);
export const parseRemoteMcpAuditEvents = (value: unknown): readonly RemoteMcpAuditEvent[] => remoteMcpAuditEventsSchema.parse(value);
