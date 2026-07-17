import { createHash } from "node:crypto";
import {
  parseModelAuditFinishInput,
  parseModelAuditStartInput,
  type ModelAuditEvent,
  type ModelAuditFinishInput,
  type ModelAuditStartInput,
  type ModelAuditTarget,
  type ModelCompletion,
  type ModelContext,
  type ModelInvocation,
} from "@bubu/contracts";

export interface ModelAuditScope {
  readonly purpose: "provider-connection-test" | "query-plan" | "group-query-plan";
  readonly target: ModelAuditTarget;
  readonly contexts: readonly ModelContext[];
  readonly relationshipCount: number;
}

export interface AuditedModelRuntime {
  startModelAudit(input: ModelAuditStartInput): Promise<ModelAuditEvent>;
  finishModelAudit(input: ModelAuditFinishInput): Promise<ModelAuditEvent>;
  generateModel(invocation: ModelInvocation, signal?: AbortSignal): Promise<ModelCompletion>;
}

export function buildModelAuditStart(
  invocation: ModelInvocation,
  scope: ModelAuditScope,
): ModelAuditStartInput {
  const disclosure = scope.contexts[0]?.disclosure ?? "none";
  if (scope.contexts.some((context) => context.disclosure !== disclosure)) {
    throw new Error("一次模型请求不能混用不同的数据披露等级");
  }
  const payload = `${invocation.system}\0${invocation.user}`;
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  return parseModelAuditStartInput({
    purpose: scope.purpose,
    target: scope.target,
    disclosure,
    providerId: invocation.provider.id,
    providerKind: invocation.provider.kind,
    providerName: invocation.provider.name,
    model: invocation.provider.model,
    endpointOrigin: new URL(invocation.provider.baseUrl).origin,
    datasetCount: scope.contexts.length,
    columnCount: scope.contexts.reduce((total, context) => total + context.columns.length, 0),
    syntheticRowCount: scope.contexts.reduce((total, context) => total + context.syntheticRows.length, 0),
    relationshipCount: scope.relationshipCount,
    payloadBytes,
    estimatedInputTokens: Math.max(1, Math.ceil(payloadBytes / 3)),
    maxOutputTokens: invocation.maxOutputTokens,
    payloadSha256: createHash("sha256").update(payload).digest("hex"),
    containsRawRows: false,
  });
}

export async function generateAuditedModel(
  runtime: AuditedModelRuntime,
  invocation: ModelInvocation,
  scope: ModelAuditScope,
  signal?: AbortSignal,
): Promise<ModelCompletion> {
  const audit = await runtime.startModelAudit(buildModelAuditStart(invocation, scope));
  let completion: ModelCompletion;
  try {
    completion = await runtime.generateModel(invocation, signal);
  } catch (error) {
    const finish = parseModelAuditFinishInput({
      id: audit.id,
      status: signal?.aborted ? "cancelled" : "failed",
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      outputBytes: 0,
      error: boundedAuditError(error),
    });
    try {
      await runtime.finishModelAudit(finish);
    } catch (auditError) {
      throw new AggregateError([error, auditError], "模型请求失败，且本地隐私账本未能完成终态写入");
    }
    throw error;
  }
  await runtime.finishModelAudit(parseModelAuditFinishInput({
    id: audit.id,
    status: "succeeded",
    inputTokens: completion.usage.inputTokens ?? null,
    outputTokens: completion.usage.outputTokens ?? null,
    totalTokens: completion.usage.totalTokens ?? null,
    outputBytes: Buffer.byteLength(completion.text, "utf8"),
    error: null,
  }));
  return completion;
}

function boundedAuditError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Model request failed";
  return [...message].slice(0, 2_000).join("") || "Model request failed";
}
