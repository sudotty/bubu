import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  externalDeliveryTestPayloadSchema,
  parseExternalDeliveryJob,
  parseExternalDeliveryJobs,
  parseExternalDeliveryPayload,
  parseWebhookDestinationInput,
  parseWebhookRegistry,
  parseWorkflowDeliveryBindingInput,
  parseWorkflowDeliveryBindings,
  type ExternalDeliveryJob,
  type WebhookRegistry,
  type WorkflowDeliveryBinding,
  type WorkflowRun,
} from "@bubu/contracts";
import { decideExternalDeliveryFailure } from "@bubu/product-core";
import type { CredentialCipher } from "./provider-store.js";
import { fetchResolvedPublicTarget, resolvePublicRemoteTarget } from "./remote-network.js";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";
import { startNonOverlappingScheduler } from "./non-overlapping-scheduler.js";

interface DestinationRecord { readonly version: 1; readonly id: string; readonly name: string; readonly url: string; readonly encryptedSecret: string; readonly createdAt: string; readonly updatedAt: string }
interface Options { readonly directory: string; readonly cipher: CredentialCipher; readonly now?: () => Date; readonly newId?: () => string; readonly fetchImpl?: typeof fetch; readonly resolveTarget?: (url: string) => Promise<readonly string[]> }
export interface ExternalDeliveryService {
  registry(): WebhookRegistry;
  saveDestination(value: unknown): WebhookRegistry;
  removeDestination(id: string): WebhookRegistry;
  bindings(): readonly WorkflowDeliveryBinding[];
  bind(value: unknown): readonly WorkflowDeliveryBinding[];
  unbind(workflowId: string): readonly WorkflowDeliveryBinding[];
  jobs(): readonly ExternalDeliveryJob[];
  enqueueTest(destinationId: string): ExternalDeliveryJob;
  enqueueApprovedRun(run: WorkflowRun): ExternalDeliveryJob | undefined;
  processDue(): Promise<readonly ExternalDeliveryJob[]>;
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8")) as unknown;
const errorCode = (error: unknown): string => error instanceof Error && /^Webhook returned HTTP \d{3}$/u.test(error.message) ? `HTTP_${error.message.slice(-3)}` : error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "DELIVERY_FAILED";

export function createExternalDeliveryService(options: Options): ExternalDeliveryService {
  const destinationsDirectory = join(options.directory, "destinations"); const jobsDirectory = join(options.directory, "jobs");
  preparePrivateDirectory(options.directory); preparePrivateDirectory(destinationsDirectory); preparePrivateDirectory(jobsDirectory);
  const now = options.now ?? (() => new Date()); const newId = options.newId ?? (() => randomBytes(16).toString("hex")); const resolveTarget = options.resolveTarget ?? resolvePublicRemoteTarget;
  const post = async (url: string, init: RequestInit) => { const addresses = await resolveTarget(url); return options.fetchImpl ? options.fetchImpl(url, { ...init, redirect: "manual" }) : fetchResolvedPublicTarget(url, addresses, init); };
  const destinations = new Map<string, DestinationRecord>(); const jobs = new Map<string, ExternalDeliveryJob>();
  for (const file of readdirSync(destinationsDirectory).sort()) { if (!file.endsWith(".json")) throw new Error("Webhook destination directory contains an unknown file"); const record = readJson(join(destinationsDirectory, file)) as DestinationRecord; const profile = parseWebhookRegistry({ destinations: [{ id: record.id, name: record.name, url: record.url, secretStored: true, createdAt: record.createdAt, updatedAt: record.updatedAt }], encryptionAvailable: true }).destinations[0]!; if (record.version !== 1 || profile.id !== file.slice(0, -5) || typeof record.encryptedSecret !== "string") throw new Error("Webhook destination record is invalid"); destinations.set(record.id, record); }
  for (const file of readdirSync(jobsDirectory).sort()) { if (!file.endsWith(".json")) throw new Error("External delivery job directory contains an unknown file"); const job = parseExternalDeliveryJob(readJson(join(jobsDirectory, file))); if (job.id !== file.slice(0, -5)) throw new Error("External delivery job identifier is inconsistent"); jobs.set(job.id, job.status === "delivering" ? { ...job, status: "retry-wait", nextAttemptAt: now().toISOString(), errorCode: "RESTART_RECOVERY" } : job); }
  const bindingsPath = join(options.directory, "bindings.json"); let currentBindings = existsSync(bindingsPath) ? [...parseWorkflowDeliveryBindings(readJson(bindingsPath))] : [];
  const profile = (record: DestinationRecord) => ({ id: record.id, name: record.name, url: record.url, secretStored: true as const, createdAt: record.createdAt, updatedAt: record.updatedAt });
  const registry = () => parseWebhookRegistry({ destinations: [...destinations.values()].map(profile), encryptionAvailable: options.cipher.isEncryptionAvailable() });
  const persistJob = (job: ExternalDeliveryJob) => { const parsed = parseExternalDeliveryJob(job); atomicPrivateWrite(join(jobsDirectory, `${parsed.id}.json`), `${JSON.stringify(parsed, null, 2)}\n`); jobs.set(parsed.id, parsed); return parsed; };
  const dedupedJob = (input: Omit<ExternalDeliveryJob, "id" | "dedupeKey" | "createdAt" | "attempts" | "status" | "nextAttemptAt" | "completedAt" | "errorCode">, dedupeMaterial: string) => {
    const dedupeKey = createHash("sha256").update(dedupeMaterial).digest("hex"); const existing = [...jobs.values()].find((job) => job.dedupeKey === dedupeKey); if (existing) return existing;
    return persistJob({ ...input, id: newId(), dedupeKey, status: "pending", attempts: 0, nextAttemptAt: null, createdAt: now().toISOString(), completedAt: null, errorCode: null });
  };
  const service: ExternalDeliveryService = {
    registry,
    saveDestination(value) { const input = parseWebhookDestinationInput(value); if (!options.cipher.isEncryptionAvailable()) throw new Error("Credential encryption is unavailable"); const id = input.id ?? newId(); const existing = destinations.get(id); if (input.id && !existing) throw new Error("Webhook destination does not exist"); if (!existing && destinations.size >= 20) throw new Error("Webhook destination registry is full"); const timestamp = now().toISOString(); const record: DestinationRecord = { version: 1, id, name: input.name, url: input.url, encryptedSecret: options.cipher.encrypt(input.secret).toString("base64"), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp }; atomicPrivateWrite(join(destinationsDirectory, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`); destinations.set(id, record); return registry(); },
    removeDestination(id) { const record = destinations.get(id); if (!record) throw new Error("Webhook destination does not exist"); destinations.delete(id); rmSync(join(destinationsDirectory, `${id}.json`), { force: true }); currentBindings = currentBindings.filter((binding) => binding.destinationId !== id); atomicPrivateWrite(bindingsPath, `${JSON.stringify(currentBindings, null, 2)}\n`); for (const job of jobs.values()) if (job.destinationId === id && !["succeeded", "failed", "revoked"].includes(job.status)) persistJob({ ...job, status: "revoked", completedAt: now().toISOString(), nextAttemptAt: null, errorCode: "DESTINATION_REVOKED" }); return registry(); },
    bindings: () => parseWorkflowDeliveryBindings(currentBindings),
    bind(value) { const input = parseWorkflowDeliveryBindingInput(value); if (!destinations.has(input.destinationId)) throw new Error("Webhook destination does not exist"); currentBindings = [...currentBindings.filter(({ workflowId }) => workflowId !== input.workflowId), { ...input, createdAt: now().toISOString() }]; atomicPrivateWrite(bindingsPath, `${JSON.stringify(currentBindings, null, 2)}\n`); return parseWorkflowDeliveryBindings(currentBindings); },
    unbind(workflowId) { currentBindings = currentBindings.filter((binding) => binding.workflowId !== workflowId); atomicPrivateWrite(bindingsPath, `${JSON.stringify(currentBindings, null, 2)}\n`); return parseWorkflowDeliveryBindings(currentBindings); },
    jobs: () => parseExternalDeliveryJobs([...jobs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 500)),
    enqueueTest(destinationId) { if (!destinations.has(destinationId)) throw new Error("Webhook destination does not exist"); const payloadJson = JSON.stringify(externalDeliveryTestPayloadSchema.parse({ schemaVersion: 1, event: "destination.test", status: "test", message: "BuBu webhook destination test; no product data included" })); return dedupedJob({ destinationId, workflowId: null, definitionVersion: null, runId: null, kind: "test", payloadJson }, `test:${destinationId}:${now().toISOString()}:${newId()}`); },
    enqueueApprovedRun(run) { const binding = currentBindings.find(({ workflowId, definitionVersion }) => workflowId === run.workflowId && definitionVersion === run.definitionVersion); if (!binding || run.status !== "succeeded" || !run.steps.some((step) => step.kind === "human-approval" && step.status === "succeeded")) return undefined; const artifactStep = [...run.steps].reverse().find((step) => step.kind !== "human-approval" && step.status === "succeeded"); const result = artifactStep?.result; const artifact = result && result.kind !== "human-approval" && typeof result.value === "object" && result.value !== null && "artifact" in result.value && typeof result.value.artifact === "object" && result.value.artifact !== null && "id" in result.value.artifact && typeof result.value.artifact.id === "string" ? { kind: result.kind, id: result.value.artifact.id } : null; const payload = parseExternalDeliveryPayload({ schemaVersion: 1, event: "workflow.completed", status: "succeeded", workflowId: run.workflowId, definitionVersion: run.definitionVersion, runId: run.id, artifact, openHint: `workflow:${run.workflowId}:run:${run.id}` }); const payloadJson = JSON.stringify(payload); return dedupedJob({ destinationId: binding.destinationId, workflowId: run.workflowId, definitionVersion: run.definitionVersion, runId: run.id, kind: "workflow-completed", payloadJson }, `workflow:${run.workflowId}:${run.definitionVersion}:${run.id}:${binding.destinationId}`); },
    async processDue() { const completed: ExternalDeliveryJob[] = []; const timestamp = now(); for (const job of [...jobs.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) { if (!(job.status === "pending" || job.status === "retry-wait" && job.nextAttemptAt !== null && Date.parse(job.nextAttemptAt) <= timestamp.getTime())) continue; const destination = destinations.get(job.destinationId); if (!destination) { completed.push(persistJob({ ...job, status: "revoked", completedAt: timestamp.toISOString(), nextAttemptAt: null, errorCode: "DESTINATION_REVOKED" })); continue; } const delivering = persistJob({ ...job, status: "delivering", attempts: job.attempts + 1, nextAttemptAt: null, errorCode: null }); try { const secret = options.cipher.decrypt(Buffer.from(destination.encryptedSecret, "base64")); const signature = createHmac("sha256", secret).update(delivering.payloadJson).digest("hex"); const response = await post(destination.url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "BuBu-Webhook/1", "x-bubu-signature-v1": `sha256=${signature}`, "x-bubu-delivery-id": delivering.id }, body: delivering.payloadJson, signal: AbortSignal.timeout(15_000) }); if (response.status < 200 || response.status >= 300) throw new Error(`Webhook returned HTTP ${response.status}`); completed.push(persistJob({ ...delivering, status: "succeeded", completedAt: now().toISOString(), errorCode: null })); } catch (error) { const decision = decideExternalDeliveryFailure({ attempts: delivering.attempts, now: now().toISOString(), errorCode: errorCode(error) }); completed.push(persistJob({ ...delivering, status: decision.status, nextAttemptAt: decision.nextAttemptAt, completedAt: decision.status === "failed" ? now().toISOString() : null, errorCode: decision.errorCode })); } } return completed; },
  };
  return service;
}

export function startExternalDeliveryScheduler(service: ExternalDeliveryService, onError: (error: unknown) => void = () => undefined): () => void {
  return startNonOverlappingScheduler({ intervalMilliseconds: 10_000, task: () => service.processDue(), onError });
}
