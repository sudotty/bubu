import { describe, expect, it } from "vitest";
import { parseHubApplyRemoteObjectInput, parseHubAppliedObjectReceipt, parseLocalSyncedObjectPreview, parseSyncPushOperation, syncObjectKindSchema } from "./hub-sync.js";
const id = (value: string) => value.repeat(32);
describe("Hub sync contracts", () => {
  it("allows only explicit encrypted product objects with exact immutable versions", () => {
    const operation = parseSyncPushOperation({ schemaVersion: 1, operationId: "123e4567-e89b-42d3-a456-426614174000", tenantId: id("b"), deviceId: id("c"), objectId: id("d"), objectKind: "workflow-definition", baseVersion: null, objectVersion: 1, deleted: false, payload: { algorithm: "aes-256-gcm", keyId: id("e"), nonce: "A".repeat(16), ciphertext: "Q", contentSha256: "f".repeat(64) }, createdAt: "2026-07-29T00:00:00Z" });
    expect(operation.objectVersion).toBe(1); expect(syncObjectKindSchema.options).not.toContain("dataset-rows");
    expect(() => parseSyncPushOperation({ ...operation, baseVersion: 1, objectVersion: 3 })).toThrow();
    expect(() => parseSyncPushOperation({ ...operation, rawRows: [] })).toThrow();
  });
  it("requires tombstones to omit encrypted content", () => {
    const base = { schemaVersion: 1, operationId: "123e4567-e89b-42d3-a456-426614174000", tenantId: id("b"), deviceId: id("c"), objectId: id("d"), objectKind: "report-evidence", baseVersion: 1, objectVersion: 2, createdAt: "2026-07-29T00:00:00Z" };
    expect(parseSyncPushOperation({ ...base, deleted: true, payload: null }).deleted).toBe(true);
    expect(() => parseSyncPushOperation({ ...base, deleted: true, payload: { algorithm: "aes-256-gcm" } })).toThrow();
  });
  it("binds reviewed remote application to the exact decrypted digest and immutable version", () => {
    const selection = parseHubApplyRemoteObjectInput({ objectId: id("a"), objectVersion: 2, expectedContentSha256: "b".repeat(64), decision: "apply-if-absent-or-identical" });
    expect(selection.objectVersion).toBe(2);
    expect(() => parseHubApplyRemoteObjectInput({ ...selection, expectedContentSha256: "short" })).toThrow();
    const receipt = parseHubAppliedObjectReceipt({ schemaVersion: 1, objectId: selection.objectId, objectKind: "workflow-definition", objectVersion: 2, remoteSequence: 7, contentSha256: selection.expectedContentSha256, localWorkflowVersion: 3, localDisposition: "replaced", appliedAt: "2026-07-29T00:00:00Z" });
    expect(receipt.localWorkflowVersion).toBe(3);
  });
  it("exposes a plaintext digest with a bounded decrypted preview", () => {
    expect(parseLocalSyncedObjectPreview({ object: { objectId: id("a"), objectKind: "workflow-definition", objectVersion: 1, sequence: 1, deleted: false, receivedAt: "2026-07-29T00:00:00Z" }, contentJson: "{}", contentSha256: "c".repeat(64) }).contentSha256).toHaveLength(64);
  });
});
