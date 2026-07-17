import { describe, expect, it, vi } from "vitest";
import type {
  ModelAuditEvent,
  ModelAuditFinishInput,
  ModelAuditStartInput,
  ModelInvocation,
} from "@bubu/contracts";
import { buildModelAuditStart, generateAuditedModel, type AuditedModelRuntime } from "./model-audit.js";

const invocation: ModelInvocation = {
  provider: {
    id: "a".repeat(32), name: "Provider", kind: "openai",
    baseUrl: "https://user:secret@api.example.com/v1/?key=hidden", model: "model",
  },
  credential: "secret",
  system: "Plan safely",
  user: JSON.stringify({ question: "total", context: "synthetic only" }),
  maxOutputTokens: 100,
};

const context = {
  datasetId: "b".repeat(32),
  versionId: "c".repeat(32),
  disclosure: "schema-synthetic" as const,
  columns: [{ name: "Amount", type: "real" as const, nullable: false, unique: false }],
  syntheticRows: [[101.25], [102.25], [103.25]],
};

describe("audited model invocation", () => {
  it("summarizes and hashes the exact prompt without persisting it or URL secrets", () => {
    const audit = buildModelAuditStart(invocation, {
      purpose: "query-plan",
      target: { kind: "dataset", id: context.datasetId },
      contexts: [context],
      relationshipCount: 0,
    });
    expect(audit).toMatchObject({
      endpointOrigin: "https://api.example.com",
      datasetCount: 1,
      columnCount: 1,
      syntheticRowCount: 3,
      containsRawRows: false,
    });
    expect(JSON.stringify(audit)).not.toContain("total");
    expect(JSON.stringify(audit)).not.toContain("secret");
  });

  it("starts before provider I/O and persists terminal usage", async () => {
    const order: string[] = [];
    const started: ModelAuditEvent = {
      ...buildModelAuditStart(invocation, {
        purpose: "query-plan", target: { kind: "dataset", id: context.datasetId },
        contexts: [context], relationshipCount: 0,
      }),
      id: "d".repeat(32), status: "started", inputTokens: null, outputTokens: null,
      totalTokens: null, outputBytes: null, error: null,
      startedAt: "2026-07-17T00:00:00Z", finishedAt: null,
    };
    const finish = vi.fn(async (input: ModelAuditFinishInput) => ({ ...started, ...input } as ModelAuditEvent));
    const runtime: AuditedModelRuntime = {
      startModelAudit: async (_input: ModelAuditStartInput) => { order.push("audit"); return started; },
      generateModel: async () => {
        order.push("provider");
        return { providerId: invocation.provider.id, providerKind: "openai", model: "model", text: "{}", usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } };
      },
      finishModelAudit: finish,
    };
    await generateAuditedModel(runtime, invocation, {
      purpose: "query-plan", target: { kind: "dataset", id: context.datasetId },
      contexts: [context], relationshipCount: 0,
    });
    expect(order).toEqual(["audit", "provider"]);
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded", totalTokens: 12 }));
  });

  it("persists cancellation instead of leaving a started request", async () => {
    const auditInput = buildModelAuditStart(invocation, {
      purpose: "query-plan", target: { kind: "dataset", id: context.datasetId },
      contexts: [context], relationshipCount: 0,
    });
    const started = {
      ...auditInput, id: "e".repeat(32), status: "started" as const,
      inputTokens: null, outputTokens: null, totalTokens: null, outputBytes: null,
      error: null, startedAt: "2026-07-17T00:00:00Z", finishedAt: null,
    };
    const finish = vi.fn(async (input: ModelAuditFinishInput) => ({ ...started, ...input } as ModelAuditEvent));
    const controller = new AbortController();
    controller.abort();
    const runtime: AuditedModelRuntime = {
      startModelAudit: async () => started,
      generateModel: async () => { throw new Error("Operation cancelled"); },
      finishModelAudit: finish,
    };
    await expect(generateAuditedModel(runtime, invocation, {
      purpose: "query-plan", target: { kind: "dataset", id: context.datasetId },
      contexts: [context], relationshipCount: 0,
    }, controller.signal)).rejects.toThrow("cancelled");
    expect(finish).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
  });
});
