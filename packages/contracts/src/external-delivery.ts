import { z } from "zod";
import { datasetIdSchema } from "./dataset.js";
import { workflowTargetSchema } from "./workflow.js";

const webhookUrlSchema = z.string().url().max(2_048).superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) context.addIssue({ code: "custom", message: "Webhook must be credential-free HTTPS without a fragment" });
});
const secretSchema = z.string().min(16).max(4_096).refine((value) => !/[\0\r\n]/u.test(value), "Webhook secret contains control characters");

export const webhookDestinationInputSchema = z.object({ id: datasetIdSchema.optional(), name: z.string().trim().min(1).max(100), url: webhookUrlSchema, secret: secretSchema }).strict();
export const webhookDestinationProfileSchema = z.object({ id: datasetIdSchema, name: z.string().trim().min(1).max(100), url: webhookUrlSchema, secretStored: z.literal(true), createdAt: z.string().datetime({ offset: true }), updatedAt: z.string().datetime({ offset: true }) }).strict();
export const webhookRegistrySchema = z.object({ destinations: z.array(webhookDestinationProfileSchema).max(20), encryptionAvailable: z.boolean() }).strict();
export const workflowDeliveryBindingInputSchema = z.object({ workflowId: datasetIdSchema, definitionVersion: z.number().int().positive(), target: workflowTargetSchema, destinationId: datasetIdSchema }).strict();
export const workflowDeliveryBindingSchema = workflowDeliveryBindingInputSchema.extend({ createdAt: z.string().datetime({ offset: true }) }).strict();
export const workflowDeliveryBindingsSchema = z.array(workflowDeliveryBindingSchema).max(100);
export const externalDeliveryPayloadSchema = z.object({ schemaVersion: z.literal(1), event: z.literal("workflow.completed"), status: z.literal("succeeded"), workflowId: datasetIdSchema, definitionVersion: z.number().int().positive(), runId: datasetIdSchema, artifact: z.object({ kind: z.enum(["dataset-query", "group-query"]), id: datasetIdSchema }).strict().nullable(), openHint: z.string().regex(/^workflow:[a-f0-9]{32}:run:[a-f0-9]{32}$/u) }).strict();
export const externalDeliveryTestPayloadSchema = z.object({ schemaVersion: z.literal(1), event: z.literal("destination.test"), status: z.literal("test"), message: z.literal("BuBu webhook destination test; no product data included") }).strict();
export const externalDeliveryJobSchema = z.object({ id: datasetIdSchema, dedupeKey: z.string().regex(/^[a-f0-9]{64}$/u), destinationId: datasetIdSchema, workflowId: datasetIdSchema.nullable(), definitionVersion: z.number().int().positive().nullable(), runId: datasetIdSchema.nullable(), kind: z.enum(["test", "workflow-completed"]), payloadJson: z.string().min(2).max(8_192), status: z.enum(["pending", "delivering", "retry-wait", "succeeded", "failed", "revoked"]), attempts: z.number().int().min(0).max(3), nextAttemptAt: z.string().datetime({ offset: true }).nullable(), createdAt: z.string().datetime({ offset: true }), completedAt: z.string().datetime({ offset: true }).nullable(), errorCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/u).nullable() }).strict().superRefine((job, context) => {
  if (job.status === "retry-wait" && job.nextAttemptAt === null) context.addIssue({ code: "custom", message: "Retry wait requires a next attempt" });
  if ((job.status === "succeeded" || job.status === "failed" || job.status === "revoked") && job.completedAt === null) context.addIssue({ code: "custom", message: "Terminal delivery requires completion time" });
  if (job.kind === "test" && (job.workflowId !== null || job.runId !== null || job.definitionVersion !== null)) context.addIssue({ code: "custom", message: "Test delivery cannot bind workflow data" });
});
export const externalDeliveryJobsSchema = z.array(externalDeliveryJobSchema).max(500);

export type WebhookDestinationInput = z.infer<typeof webhookDestinationInputSchema>;
export type WebhookDestinationProfile = z.infer<typeof webhookDestinationProfileSchema>;
export type WebhookRegistry = z.infer<typeof webhookRegistrySchema>;
export type WorkflowDeliveryBindingInput = z.infer<typeof workflowDeliveryBindingInputSchema>;
export type WorkflowDeliveryBinding = z.infer<typeof workflowDeliveryBindingSchema>;
export type ExternalDeliveryPayload = z.infer<typeof externalDeliveryPayloadSchema>;
export type ExternalDeliveryJob = z.infer<typeof externalDeliveryJobSchema>;
export const parseWebhookDestinationInput = (value: unknown): WebhookDestinationInput => webhookDestinationInputSchema.parse(value);
export const parseWebhookRegistry = (value: unknown): WebhookRegistry => webhookRegistrySchema.parse(value);
export const parseWorkflowDeliveryBindingInput = (value: unknown): WorkflowDeliveryBindingInput => workflowDeliveryBindingInputSchema.parse(value);
export const parseWorkflowDeliveryBindings = (value: unknown): readonly WorkflowDeliveryBinding[] => workflowDeliveryBindingsSchema.parse(value);
export const parseExternalDeliveryPayload = (value: unknown): ExternalDeliveryPayload => externalDeliveryPayloadSchema.parse(value);
export const parseExternalDeliveryJob = (value: unknown): ExternalDeliveryJob => externalDeliveryJobSchema.parse(value);
export const parseExternalDeliveryJobs = (value: unknown): readonly ExternalDeliveryJob[] => externalDeliveryJobsSchema.parse(value);
