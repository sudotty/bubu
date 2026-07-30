import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HubAuthority, verifyHubAuditPage } from "./authority.js";

const payload = { algorithm: "aes-256-gcm" as const, keyId: "9".repeat(32), nonce: "A".repeat(16), ciphertext: "Q", contentSha256: "4ae81572f06e1b88fd5ced7a1a000945432e83e1551e6f721ee9c00b8cc33260" };
describe("optional Hub authority", () => {
  it("enforces the bounded single-writer deployment ceilings before mutation", () => {
    const tenants = new HubAuthority({ limits: { tenants: 1 } }); tenants.bootstrap({ tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" }); expect(() => tenants.bootstrap({ tenantName: "Other", ownerName: "Owner", deviceName: "Mac" })).toThrow("tenant limit");
    const audits = new HubAuthority({ limits: { auditsPerTenant: 1 } }); const bootstrap = audits.bootstrap({ tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" }); expect(() => audits.createMember(bootstrap.deviceToken, { displayName: "Editor", role: "editor" })).toThrow("audit event limit"); expect(audits.audit(bootstrap.deviceToken).events).toHaveLength(1);
  });
  it("rejects malformed persisted authority state at the file or database boundary", () => {
    expect(() => new HubAuthority({ initialState: { version: 1, tenants: [], unexpected: true } })).toThrow("state");
    const authority = new HubAuthority(); authority.bootstrap({ tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" }); const snapshot = authority.snapshot(); (snapshot.tenants[0]!.devices[0] as { tokenHash: string }).tokenHash = "plaintext-token"; expect(() => new HubAuthority({ initialState: snapshot })).toThrow("state");
    const mismatched = authority.snapshot(); const other = new HubAuthority(); other.bootstrap({ tenantName: "Other", ownerName: "Owner", deviceName: "Mac" }); (mismatched.tenants[0] as { privateKeyPem: string }).privateKeyPem = other.snapshot().tenants[0]!.privateKeyPem; expect(() => new HubAuthority({ initialState: mismatched })).toThrow("state");
  });
  it("enforces RBAC, immutable versions, idempotency, explicit conflict, revocation and signed audit persistence", () => {
    let number = 0; const statePath = join(mkdtempSync(join(tmpdir(), "bubu-hub-")), "state.json"); const authority = new HubAuthority({ statePath, now: () => new Date("2026-07-29T00:00:00Z"), randomId: () => (++number).toString(16).padStart(32, "0"), randomToken: () => `token-${(++number).toString().padStart(40, "0")}` });
    const bootstrap = authority.bootstrap({ tenantName: "Acme", ownerName: "Owner", deviceName: "Owner Mac" });
    const editor = authority.createMember(bootstrap.deviceToken, { displayName: "Editor", role: "editor" }); const editorDevice = authority.createDevice(bootstrap.deviceToken, { memberId: editor.id, name: "Editor Mac" });
    const viewer = authority.createMember(bootstrap.deviceToken, { displayName: "Viewer", role: "viewer" }); const viewerDevice = authority.createDevice(bootstrap.deviceToken, { memberId: viewer.id, name: "Viewer Mac" });
    const base = { schemaVersion: 1 as const, operationId: "123e4567-e89b-42d3-a456-426614174000", tenantId: bootstrap.tenant.id, deviceId: editorDevice.device.id, objectId: "b".repeat(32), objectKind: "workflow-definition" as const, baseVersion: null, objectVersion: 1, deleted: false, payload, createdAt: "2026-07-29T00:00:00Z" };
    expect(authority.push(editorDevice.deviceToken, base)).toMatchObject({ status: "accepted", idempotent: false }); expect(authority.push(editorDevice.deviceToken, base)).toMatchObject({ status: "accepted", idempotent: true });
    expect(() => authority.push(viewerDevice.deviceToken, { ...base, operationId: "123e4567-e89b-42d3-a456-426614174001", deviceId: viewerDevice.device.id })).toThrow("lacks sync:write");
    expect(authority.push(editorDevice.deviceToken, { ...base, operationId: "123e4567-e89b-42d3-a456-426614174002", baseVersion: null })).toMatchObject({ status: "conflict", currentVersion: 1 });
    expect(authority.pull(viewerDevice.deviceToken, { schemaVersion: 1, tenantId: bootstrap.tenant.id, deviceId: viewerDevice.device.id, afterSequence: 0, limit: 10 }).objects).toHaveLength(1);
    expect(verifyHubAuditPage(authority.audit(bootstrap.deviceToken), bootstrap.auditVerificationKey)).toBe(true);
    authority.revokeDevice(bootstrap.deviceToken, editorDevice.device.id); expect(() => authority.pull(editorDevice.deviceToken, { schemaVersion: 1, tenantId: bootstrap.tenant.id, deviceId: editorDevice.device.id, afterSequence: 0, limit: 10 })).toThrow("revoked");
    const recovered = new HubAuthority({ statePath }); expect(verifyHubAuditPage(recovered.audit(bootstrap.deviceToken), bootstrap.auditVerificationKey)).toBe(true);
  });
});
