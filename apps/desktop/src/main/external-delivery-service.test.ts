import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createExternalDeliveryService } from "./external-delivery-service.js";

const cipher = { isEncryptionAvailable: () => true, encrypt: (value: string) => Buffer.from(`enc:${value}`), decrypt: (value: Buffer) => value.subarray(4).toString() };
const workflowId = "a".repeat(32); const runId = "b".repeat(32); const destinationId = "c".repeat(32);
const approvedRun = { id: runId, workflowId, definitionVersion: 2, idempotencyKey: "d".repeat(32), status: "succeeded" as const, startedAt: "2026-07-29T00:00:00Z", finishedAt: "2026-07-29T00:00:01Z", error: null, steps: [{ id: "e".repeat(32), stepId: "human-checkpoint", ordinal: 0, kind: "human-approval" as const, status: "succeeded" as const, attempt: 1, startedAt: "2026-07-29T00:00:00Z", finishedAt: "2026-07-29T00:00:01Z", error: null, result: { kind: "human-approval" as const, value: { approvalId: "f".repeat(32), decision: "approved" as const, decidedAt: "2026-07-29T00:00:01Z" } } }] };

describe("external delivery service", () => {
  it("encrypts secrets, deduplicates approved runs, signs minimal payload and records success", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bubu-delivery-")); const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }));
    const service = createExternalDeliveryService({ directory, cipher, now: () => new Date("2026-07-29T00:00:02Z"), newId: (() => { const ids = [destinationId, "1".repeat(32)]; return () => ids.shift()!; })(), fetchImpl, resolveTarget: async () => ["93.184.216.34"] });
    service.saveDestination({ name: "Ops", url: "https://hooks.example.com/bubu", secret: "top-secret-value" });
    expect(JSON.stringify(service.registry())).not.toContain("top-secret"); expect(readFileSync(join(directory, "destinations", `${destinationId}.json`), "utf8")).not.toContain("top-secret-value");
    service.bind({ workflowId, definitionVersion: 2, target: { kind: "dataset", id: workflowId }, destinationId });
    const first = service.enqueueApprovedRun(approvedRun); const second = service.enqueueApprovedRun(approvedRun); expect(second?.id).toBe(first?.id);
    await service.processDue(); expect(service.jobs()[0]).toMatchObject({ status: "succeeded", attempts: 1 });
    const request = fetchImpl.mock.calls[0]?.[1]; expect(request?.headers).toHaveProperty("x-bubu-signature-v1"); expect(String(request?.body)).not.toMatch(/row|path|question|prompt|secret/iu);
  });
  it("retries twice then preserves final failure evidence and revokes pending jobs with destination", async () => {
    let sequence = 0; let clock = Date.parse("2026-07-29T00:00:00Z"); const service = createExternalDeliveryService({ directory: mkdtempSync(join(tmpdir(), "bubu-delivery-fail-")), cipher, now: () => new Date(clock), newId: () => sequence++ === 0 ? destinationId : sequence.toString(16).padStart(32, "0"), fetchImpl: async () => new Response(null, { status: 503 }), resolveTarget: async () => ["93.184.216.34"] });
    service.saveDestination({ name: "Ops", url: "https://hooks.example.com/bubu", secret: "top-secret-value" }); service.enqueueTest(destinationId);
    await service.processDue(); expect(service.jobs()[0]?.status).toBe("retry-wait"); clock += 30_000; await service.processDue(); clock += 120_000; await service.processDue(); expect(service.jobs()[0]).toMatchObject({ status: "failed", attempts: 3, errorCode: "HTTP_503" });
    service.enqueueTest(destinationId); service.removeDestination(destinationId); expect(service.jobs()[0]?.status).toBe("revoked");
  });
});
