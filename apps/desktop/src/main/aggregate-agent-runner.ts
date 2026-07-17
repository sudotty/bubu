import {
  aggregateAgentBudget,
  parseAggregateAgentDecisionText,
  parseAggregateAgentRun,
  type AggregateAgentRun,
  type AggregateAgentToolObservation,
  type AggregateDisclosure,
  type ModelCompletion,
  type ModelInvocation,
} from "@bubu/contracts";
import type { ResolvedProvider } from "./provider-store.js";
import { buildAggregateAgentInvocation } from "./analysis-orchestrator.js";
import { executeAggregateAgentTool } from "./aggregate-agent-tools.js";

interface AggregateAgentTurnResult {
  readonly completion: ModelCompletion;
  readonly auditId: string;
}

interface BoundedAggregateAgentOptions {
  readonly id: string;
  readonly resolved: ResolvedProvider;
  readonly disclosure: AggregateDisclosure;
  readonly generateTurn: (invocation: ModelInvocation, signal: AbortSignal) => Promise<AggregateAgentTurnResult>;
  readonly signal?: AbortSignal;
  readonly timeoutSignal?: AbortSignal;
  readonly now?: () => number;
}

function assertAgentActive(signal: AbortSignal | undefined, timeoutSignal: AbortSignal): void {
  if (signal?.aborted) throw new Error("Aggregate agent run was cancelled");
  if (timeoutSignal.aborted) throw new Error("Aggregate agent run exceeded its 60-second budget");
}

export async function runBoundedAggregateAgent({
  id,
  resolved,
  disclosure,
  generateTurn,
  signal,
  timeoutSignal = AbortSignal.timeout(aggregateAgentBudget.maxDurationMs),
  now = Date.now,
}: BoundedAggregateAgentOptions): Promise<AggregateAgentRun> {
  const startedAt = new Date(now()).toISOString();
  const observations: AggregateAgentToolObservation[] = [];
  const turns: Array<AggregateAgentRun["turns"][number]> = [];
  const runSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  for (let turn = 1; turn <= aggregateAgentBudget.maxTurns; turn += 1) {
    assertAgentActive(signal, timeoutSignal);
    let generated: AggregateAgentTurnResult;
    try {
      generated = await generateTurn(
        buildAggregateAgentInvocation(resolved, disclosure, observations, turn),
        runSignal,
      );
    } catch (error) {
      assertAgentActive(signal, timeoutSignal);
      throw error;
    }
    assertAgentActive(signal, timeoutSignal);
    const decision = parseAggregateAgentDecisionText(generated.completion.text);
    if (decision.action === "finish") {
      turns.push({ turn, auditId: generated.auditId, action: "finish" });
      return parseAggregateAgentRun({
        schemaVersion: 1,
        id,
        disclosure,
        budget: aggregateAgentBudget,
        startedAt,
        finishedAt: new Date(now()).toISOString(),
        turns,
        report: decision.report,
      });
    }
    if (observations.length >= aggregateAgentBudget.maxToolCalls) {
      throw new Error("Aggregate agent did not finish within its fixed budget");
    }
    const observation = executeAggregateAgentTool(disclosure, decision.call);
    observations.push(observation);
    turns.push({
      turn,
      auditId: generated.auditId,
      action: "tool",
      observation,
    });
  }
  throw new Error("Aggregate agent did not finish within its fixed budget");
}
