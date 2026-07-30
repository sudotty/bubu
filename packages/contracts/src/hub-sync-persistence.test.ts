import { describe, expect, it } from "vitest";
import { parseHubStoredConnection, parseHubStoredCredentials, parseHubStoredOutbox, parseHubSyncCatalog, parseHubSyncCursor } from "./hub-sync-persistence.js";

const id = "a".repeat(32);

describe("Hub private persistence boundaries", () => {
  it("strictly parses connection, credentials, catalog, and cursor files", () => {
    expect(parseHubStoredConnection({ version: 1, profile: { baseUrl: "https://hub.example.com/", tenantId: id, deviceId: "b".repeat(32), role: "owner", configured: true, encryptionAvailable: true }, encryptedCredentials: "ZW5j" })).toMatchObject({ version: 1 });
    expect(parseHubStoredCredentials({ deviceToken: "t".repeat(32), contentKey: "A".repeat(43), auditVerificationKey: "B".repeat(43) })).toMatchObject({ contentKey: "A".repeat(43) });
    expect(parseHubSyncCatalog({ [id]: { objectVersion: 2, contentSha256: "f".repeat(64) } })).toMatchObject({ [id]: { objectVersion: 2 } });
    expect(parseHubSyncCursor(0)).toBe(0);
    expect(() => parseHubSyncCursor(-1)).toThrow();
    expect(() => parseHubStoredCredentials({ deviceToken: "t".repeat(32), contentKey: "A".repeat(43), auditVerificationKey: "B".repeat(43), plaintext: true })).toThrow();
  });

  it("rejects an outbox whose public state is detached from its exact operation", () => {
    const operation = { schemaVersion: 1, operationId: "123e4567-e89b-42d3-a456-426614174000", tenantId: id, deviceId: "b".repeat(32), objectId: "c".repeat(32), objectKind: "workflow-definition", baseVersion: null, objectVersion: 1, deleted: true, payload: null, createdAt: "2026-07-29T00:00:00Z" } as const;
    const publicState = { id: "d".repeat(32), objectId: operation.objectId, objectKind: operation.objectKind, objectVersion: 2, status: "pending", attempts: 0, createdAt: operation.createdAt, completedAt: null, errorCode: null, conflict: null } as const;
    expect(() => parseHubStoredOutbox({ public: publicState, operation, plaintextContentSha256: "deleted" })).toThrow("does not match");
  });
});
