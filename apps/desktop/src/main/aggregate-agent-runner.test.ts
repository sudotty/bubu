import { describe, expect, it } from "vitest";
import type { AggregateDisclosure, ModelCompletion } from "@bubu/contracts";
import { runBoundedAggregateAgent } from "./aggregate-agent-runner.js";

const provider = {
  id: "a".repeat(32),
  name: "Model",
  kind: "openai" as const,
  baseUrl: "https://api.openai.com/v1/",
  model: "configured-model",
};

const disclosure: AggregateDisclosure = {
  schemaVersion: 1,
  target: { kind: "dataset", id: "b".repeat(32) },
  question: "Find and verify the important difference",
  purpose: "Regional totals",
  sourceCount: 1,
  columns: [
    { label: "Region", type: "text" },
    { label: "sum(Amount)", type: "real" },
    { label: "count(*)", type: "integer" },
  ],
  rows: [["North", 1200, 8], ["South", 900, 6], ["West", 600, 5]],
  truncated: false,
  minimumGroupSize: 5,
};

const report = {
  schemaVersion: 1 as const,
  summary: "North leads the approved regional totals.",
  findings: [{
    title: "North leads",
    detail: "North is 300 above South.",
    evidence: [{ rowIndex: 0, columnIndex: 1 }, { rowIndex: 1, columnIndex: 1 }],
  }],
  caveats: [],
  nextQuestions: [],
};

function completion(text: string): ModelCompletion {
  return {
    providerId: provider.id,
    providerKind: provider.kind,
    model: provider.model,
    text,
    usage: {},
  };
}

describe("bounded aggregate agent runner", () => {
  it("runs a tool-observation-finish loop and retains each audit identity", async () => {
    const decisions = [
      {
        schemaVersion: 1,
        action: "tool",
        call: { name: "rank", input: { columnIndex: 1, direction: "descending", limit: 3 } },
      },
      { schemaVersion: 1, action: "finish", report },
    ];
    const invocations: string[] = [];
    let generated = 0;
    let now = Date.parse("2026-07-17T08:00:00Z");
    const run = await runBoundedAggregateAgent({
      id: "c".repeat(32),
      resolved: { profile: provider, credential: "secret" },
      disclosure,
      now: () => now += 1_000,
      generateTurn: async (invocation, signal) => {
        expect(signal.aborted).toBe(false);
        invocations.push(invocation.user);
        const decision = decisions[generated];
        const auditId = String(generated + 1).repeat(32);
        generated += 1;
        return { completion: completion(JSON.stringify(decision)), auditId };
      },
    });
    expect(run.turns).toHaveLength(2);
    expect(run.turns[0]).toMatchObject({
      action: "tool",
      auditId: "1".repeat(32),
      observation: { name: "rank", output: { ranked: [{ value: 1200 }, { value: 900 }, { value: 600 }] } },
    });
    expect(run.turns[1]).toEqual({ turn: 2, auditId: "2".repeat(32), action: "finish" });
    expect(run.report).toEqual(report);
    expect(JSON.parse(invocations[1] ?? "{}")).toMatchObject({
      turn: 2,
      observations: [{ name: "rank" }],
    });
  });

  it("can finish immediately without inventing a tool call", async () => {
    const run = await runBoundedAggregateAgent({
      id: "d".repeat(32),
      resolved: { profile: provider, credential: "secret" },
      disclosure,
      now: () => Date.parse("2026-07-17T08:00:00Z"),
      generateTurn: async () => ({
        completion: completion(JSON.stringify({ schemaVersion: 1, action: "finish", report })),
        auditId: "e".repeat(32),
      }),
    });
    expect(run.turns).toEqual([{ turn: 1, auditId: "e".repeat(32), action: "finish" }]);
  });

  it("fails closed on malformed output and on a fourth requested tool", async () => {
    await expect(runBoundedAggregateAgent({
      id: "f".repeat(32),
      resolved: { profile: provider, credential: "secret" },
      disclosure,
      generateTurn: async () => ({ completion: completion("not-json"), auditId: "1".repeat(32) }),
    })).rejects.toThrow();

    let turn = 0;
    await expect(runBoundedAggregateAgent({
      id: "f".repeat(32),
      resolved: { profile: provider, credential: "secret" },
      disclosure,
      generateTurn: async () => {
        turn += 1;
        return {
          completion: completion(JSON.stringify({
            schemaVersion: 1,
            action: "tool",
            call: { name: "rank", input: { columnIndex: 1, direction: "descending", limit: 1 } },
          })),
          auditId: String(turn).repeat(32),
        };
      },
    })).rejects.toThrow("fixed budget");
    expect(turn).toBe(4);
  });

  it("stops before provider I/O when cancelled or globally timed out", async () => {
    const cancelled = new AbortController();
    cancelled.abort();
    let calls = 0;
    await expect(runBoundedAggregateAgent({
      id: "1".repeat(32),
      resolved: { profile: provider, credential: "secret" },
      disclosure,
      signal: cancelled.signal,
      generateTurn: async () => {
        calls += 1;
        return { completion: completion("{}"), auditId: "2".repeat(32) };
      },
    })).rejects.toThrow("cancelled");

    const timedOut = new AbortController();
    timedOut.abort();
    await expect(runBoundedAggregateAgent({
      id: "3".repeat(32),
      resolved: { profile: provider, credential: "secret" },
      disclosure,
      timeoutSignal: timedOut.signal,
      generateTurn: async () => {
        calls += 1;
        return { completion: completion("{}"), auditId: "4".repeat(32) };
      },
    })).rejects.toThrow("60-second");
    expect(calls).toBe(0);
  });
});
