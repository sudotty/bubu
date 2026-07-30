import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HubAuthority } from "../../../../services/hub/src/authority.js";
import { createHubSyncService } from "./hub-sync-service.js";

const cipher = { isEncryptionAvailable: () => true, encrypt: (value: string) => Buffer.from(`enc:${value}`), decrypt: (value: Buffer) => value.subarray(4).toString() };
const workflow = { id: "a".repeat(32), version: 1, name: "Weekly regional totals", target: { kind: "dataset" as const, id: "b".repeat(32) }, threadId: "c".repeat(32), trigger: { kind: "manual" as const }, timeoutMs: 60_000, steps: [{ id: "regional-totals", kind: "dataset-query" as const, plan: { schemaVersion: 1, datasetId: "b".repeat(32), versionId: "d".repeat(32), purpose: "Regional totals", dimensions: ["Region"], measures: [{ operation: "sum" as const, column: "Amount" }], filters: [], sort: [], limit: 50 }, maxAttempts: 2 }], createdAt: "2026-07-29T00:00:00Z", updatedAt: "2026-07-29T00:00:00Z", nextDueAt: null };
function adapter(authority: HubAuthority): typeof fetch { return (async (input: RequestInfo | URL, init?: RequestInit) => { const url = new URL(String(input)); const value = init?.body ? JSON.parse(String(init.body)) as unknown : undefined; const token = new Headers(init?.headers).get("authorization")?.slice(7) ?? ""; try { const result = url.pathname === "/v1/bootstrap" ? authority.bootstrap(value) : url.pathname === "/v1/sync/push" ? authority.push(token, value) : url.pathname === "/v1/sync/pull" ? authority.pull(token, value) : url.pathname === "/v1/audit" ? authority.audit(token) : undefined; return new Response(JSON.stringify(result), { status: result ? 200 : 404, headers: { "content-type": "application/json" } }); } catch (error) { return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "failed" }), { status: 403 }); } }) as typeof fetch; }
const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
describe("desktop Hub encrypted outbox/inbox", () => {
  it("bootstraps, encrypts an explicit workflow, syncs, pulls and inspects without persisting plaintext", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-hub-sync-")); const authority = new HubAuthority(); let id = 0; const service = createHubSyncService({ directory, cipher, fetchImpl: adapter(authority), resolveTarget: async () => ["93.184.216.34"], newId: () => (++id).toString(16).padStart(32, "0"), newOperationId: () => "123e4567-e89b-42d3-a456-426614174000", now: () => new Date("2026-07-29T00:00:00Z") });
    await service.bootstrap({ baseUrl: "https://hub.example.com/", tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" }); service.queueWorkflow(workflow); expect(service.queue()[0]?.status).toBe("pending"); await service.flush(); expect(service.queue()[0]?.status).toBe("succeeded"); await service.pull(); const preview = service.inspectIncoming(workflow.id, 1); expect(preview.contentJson).toContain("Weekly regional totals");
    const prepared = service.prepareWorkflowApplication({ objectId: workflow.id, objectVersion: 1, expectedContentSha256: preview.contentSha256, decision: "apply-if-absent-or-identical" }); expect(prepared.definition.name).toBe("Weekly regional totals"); expect(() => service.prepareWorkflowApplication({ objectId: workflow.id, objectVersion: 1, expectedContentSha256: "f".repeat(64), decision: "apply-if-absent-or-identical" })).toThrow("digest");
    service.recordWorkflowApplication({ selection: { objectId: workflow.id, objectVersion: 1, expectedContentSha256: preview.contentSha256, decision: "apply-if-absent-or-identical" }, localWorkflowVersion: 2, localDisposition: "created" }); expect(service.applications()).toMatchObject([{ localDisposition: "created" }]);
    const persisted = files(directory).map((path) => readFileSync(path, "utf8")).join("\n"); expect(persisted).not.toContain("Weekly regional totals"); expect(persisted).not.toContain("Regional totals");
    expect((await service.audit()).verified).toBe(true);
  });
  it("keeps offline outbox work and replays it after restart", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-hub-offline-")); const authority = new HubAuthority(); const online = createHubSyncService({ directory, cipher, fetchImpl: adapter(authority), resolveTarget: async () => ["93.184.216.34"], newId: () => "1".repeat(32), newOperationId: () => "123e4567-e89b-42d3-a456-426614174001" }); await online.bootstrap({ baseUrl: "https://hub.example.com/", tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" });
    const offline = createHubSyncService({ directory, cipher, fetchImpl: async () => { throw new Error("offline"); }, resolveTarget: async () => ["93.184.216.34"], newId: () => "2".repeat(32), newOperationId: () => "123e4567-e89b-42d3-a456-426614174001" }); offline.queueWorkflow(workflow); await offline.flush(); expect(offline.queue()[0]).toMatchObject({ status: "pending", attempts: 1 });
    const recovered = createHubSyncService({ directory, cipher, fetchImpl: adapter(authority), resolveTarget: async () => ["93.184.216.34"] }); await recovered.flush(); expect(recovered.queue()[0]?.status).toBe("succeeded");
  });
  it("keeps conflicts explicit, rebases only after a decision, and emits tombstones", async () => {
    const authority = new HubAuthority(); const bootstrap = authority.bootstrap({ tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" }); let sequence = 0;
    const service = createHubSyncService({ directory: mkdtempSync(join(tmpdir(), "bubu-hub-conflict-")), cipher, fetchImpl: adapter(authority), resolveTarget: async () => ["93.184.216.34"], newId: () => (++sequence).toString(16).padStart(32, "0"), newOperationId: () => `123e4567-e89b-42d3-a456-${String(426614174100 + sequence++).padStart(12, "0")}` });
    service.configure({ baseUrl: "https://hub.example.com/", tenantId: bootstrap.tenant.id, deviceId: bootstrap.device.id, role: "owner", deviceToken: bootstrap.deviceToken, contentKey: "A".repeat(43), auditVerificationKey: bootstrap.auditVerificationKey });
    service.queueWorkflow(workflow); await service.flush();
    authority.push(bootstrap.deviceToken, { schemaVersion: 1, operationId: "123e4567-e89b-42d3-a456-426614174099", tenantId: bootstrap.tenant.id, deviceId: bootstrap.device.id, objectId: workflow.id, objectKind: "workflow-definition", baseVersion: 1, objectVersion: 2, deleted: false, payload: { algorithm: "aes-256-gcm", keyId: "9".repeat(32), nonce: "A".repeat(16), ciphertext: "Q", contentSha256: "4ae81572f06e1b88fd5ced7a1a000945432e83e1551e6f721ee9c00b8cc33260" }, createdAt: "2026-07-29T00:00:01Z" });
    service.queueWorkflow({ ...workflow, name: "Local reviewed change", updatedAt: "2026-07-29T00:00:02Z" }); await service.flush(); const conflict = service.queue().find(({ status }) => status === "conflict"); expect(conflict?.conflict?.currentVersion).toBe(2);
    service.resolveConflict(conflict!.id, "retry-local"); await service.flush(); expect(service.queue().find(({ id }) => id === conflict!.id)).toMatchObject({ status: "succeeded", objectVersion: 3 });
    const deletion = service.queueDelete(workflow.id, "workflow-definition"); await service.flush(); expect(service.queue().find(({ id }) => id === deletion.id)).toMatchObject({ status: "succeeded", objectVersion: 4 });
  });
  it("rejects failed or oversized audit responses before parsing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-hub-audit-boundary-")); const service = createHubSyncService({ directory, cipher, fetchImpl: async () => new Response(JSON.stringify({ error: "unavailable" }), { status: 503 }), resolveTarget: async () => ["93.184.216.34"] });
    service.configure({ baseUrl: "https://hub.example.com/", tenantId: "a".repeat(32), deviceId: "b".repeat(32), role: "auditor", deviceToken: "t".repeat(32), contentKey: "A".repeat(43), auditVerificationKey: "B".repeat(43) }); await expect(service.audit()).rejects.toThrow("HTTP 503");
  });
  it("fails closed when persisted Hub state is malformed", () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-hub-corrupt-"));
    writeFileSync(join(directory, "catalog.json"), JSON.stringify({ untrusted: { objectVersion: -1, contentSha256: "not-a-digest" } }));
    expect(() => createHubSyncService({ directory, cipher })).toThrow();
  });
});
