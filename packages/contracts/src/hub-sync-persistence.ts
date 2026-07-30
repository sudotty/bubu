import { z } from "zod";
import { datasetIdSchema } from "./dataset.js";
import { hubConnectionProfileSchema, localSyncQueueItemSchema, syncObjectVersionSchema, syncPushOperationSchema } from "./hub-sync.js";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const base64Schema = z.string().min(1).max(8_192).regex(/^[A-Za-z0-9+/]+={0,2}$/u);

export const hubStoredConnectionSchema = z.object({
  version: z.literal(1),
  profile: hubConnectionProfileSchema,
  encryptedCredentials: base64Schema,
}).strict();

export const hubStoredCredentialsSchema = z.object({
  deviceToken: z.string().min(32).max(512),
  contentKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/u),
  auditVerificationKey: z.string().regex(/^[A-Za-z0-9_-]{32,512}$/u),
}).strict();

export const hubSyncCatalogEntrySchema = z.object({
  objectVersion: z.number().int().positive(),
  contentSha256: z.union([sha256Schema, z.literal("deleted")]),
}).strict();

export const hubSyncCatalogSchema = z.record(datasetIdSchema, hubSyncCatalogEntrySchema).superRefine((value, context) => {
  if (Object.keys(value).length > 500) context.addIssue({ code: "custom", message: "Hub catalog exceeds 500 objects" });
});

export const hubSyncCursorSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const hubStoredOutboxSchema = z.object({
  public: localSyncQueueItemSchema,
  operation: syncPushOperationSchema,
  plaintextContentSha256: z.union([sha256Schema, z.literal("deleted")]),
}).strict().superRefine((value, context) => {
  if (value.public.objectId !== value.operation.objectId || value.public.objectKind !== value.operation.objectKind || value.public.objectVersion !== value.operation.objectVersion) {
    context.addIssue({ code: "custom", message: "Hub outbox public state does not match its operation" });
  }
  if (value.operation.deleted !== (value.plaintextContentSha256 === "deleted")) {
    context.addIssue({ code: "custom", message: "Hub outbox plaintext digest does not match deletion state" });
  }
});

export const hubStoredInboxSchema = z.object({
  object: syncObjectVersionSchema,
  receivedAt: z.string().datetime({ offset: true }),
}).strict();

export type HubStoredConnection = z.infer<typeof hubStoredConnectionSchema>;
export type HubStoredCredentials = z.infer<typeof hubStoredCredentialsSchema>;
export type HubSyncCatalog = z.infer<typeof hubSyncCatalogSchema>;
export type HubStoredOutbox = z.infer<typeof hubStoredOutboxSchema>;
export type HubStoredInbox = z.infer<typeof hubStoredInboxSchema>;

export const parseHubStoredConnection = (value: unknown): HubStoredConnection => hubStoredConnectionSchema.parse(value);
export const parseHubStoredCredentials = (value: unknown): HubStoredCredentials => hubStoredCredentialsSchema.parse(value);
export const parseHubSyncCatalog = (value: unknown): HubSyncCatalog => hubSyncCatalogSchema.parse(value);
export const parseHubSyncCursor = (value: unknown): number => hubSyncCursorSchema.parse(value);
export const parseHubStoredOutbox = (value: unknown): HubStoredOutbox => hubStoredOutboxSchema.parse(value);
export const parseHubStoredInbox = (value: unknown): HubStoredInbox => hubStoredInboxSchema.parse(value);
