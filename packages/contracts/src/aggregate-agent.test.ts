import { describe, expect, it } from "vitest";
import {
  aggregateAgentBudget,
  parseAggregateAgentApproval,
  parseAggregateAgentDecisionText,
  parseAggregateAgentPreparation,
  parseAggregateAgentProposal,
  parseAggregateAgentRun,
} from "./aggregate-agent.js";

const disclosure = {
  schemaVersion: 1 as const,
  target: { kind: "dataset" as const, id: "a".repeat(32) },
  question: "找出区域汇总中的重点，并验证差异。",
  purpose: "按区域汇总销售额",
  sourceCount: 1,
  columns: [
    { label: "Region", type: "text" as const },
    { label: "sum(Amount)", type: "real" as const },
    { label: "count(*)", type: "integer" as const },
  ],
  rows: [["North", 1200, 8], ["South", 900, 6], ["West", 600, 5]],
  truncated: false,
  minimumGroupSize: 5 as const,
};

const destination = {
  providerId: "b".repeat(32),
  providerKind: "openai" as const,
  providerName: "Company model",
  model: "approved-model",
  endpointOrigin: "https://api.example.com",
};

const report = {
  schemaVersion: 1 as const,
  summary: "North leads the disclosed regional totals.",
  findings: [{
    title: "North is highest",
    detail: "North exceeds South by 300 in the approved aggregate.",
    evidence: [{ rowIndex: 0, columnIndex: 1 }, { rowIndex: 1, columnIndex: 1 }],
  }],
  caveats: ["Only approved aggregate cells were analyzed."],
  nextQuestions: ["Should this be compared over time?"],
};

describe("bounded aggregate agent contracts", () => {
  it("keeps preparation renderer input limited to a reviewed plan and goal", () => {
    const plan = {
      schemaVersion: 1 as const,
      datasetId: disclosure.target.id,
      versionId: "c".repeat(32),
      purpose: disclosure.purpose,
      dimensions: ["Region"],
      measures: [
        { operation: "sum" as const, column: "Amount" },
        { operation: "count" as const, column: null },
      ],
      filters: [], sort: [], limit: 50,
    };
    expect(parseAggregateAgentPreparation({ plan, threadId: "a".repeat(32), goal: disclosure.question })).toEqual({ plan, threadId: "a".repeat(32), goal: disclosure.question });
    expect(() => parseAggregateAgentPreparation({
      plan, goal: disclosure.question, rows: disclosure.rows, tools: ["execute-sql"], maxTurns: 99,
    })).toThrow();
  });

  it("binds one opaque approval to the exact destination, disclosure, and fixed budget", () => {
    const proposal = {
      approvalToken: "d".repeat(64),
      expiresAt: "2026-07-17T08:10:00Z",
      destination,
      disclosure,
      budget: aggregateAgentBudget,
    };
    expect(parseAggregateAgentProposal(proposal)).toEqual(proposal);
    expect(parseAggregateAgentApproval({ approvalToken: proposal.approvalToken })).toEqual({
      approvalToken: proposal.approvalToken,
    });
    expect(() => parseAggregateAgentProposal({
      ...proposal,
      budget: { ...aggregateAgentBudget, maxTurns: 5 },
    })).toThrow();
    expect(() => parseAggregateAgentApproval({ approvalToken: proposal.approvalToken, goal: "replace" })).toThrow();
  });

  it("accepts only one strict local-tool request or a cited finish decision", () => {
    expect(parseAggregateAgentDecisionText(JSON.stringify({
      schemaVersion: 1,
      action: "tool",
      call: { name: "rank", input: { columnIndex: 1, direction: "descending", limit: 3 } },
    }))).toMatchObject({ action: "tool", call: { name: "rank" } });
    expect(parseAggregateAgentDecisionText(JSON.stringify({
      schemaVersion: 1,
      action: "finish",
      report,
    }))).toEqual({ schemaVersion: 1, action: "finish", report });
    expect(() => parseAggregateAgentDecisionText(JSON.stringify({
      schemaVersion: 1,
      action: "tool",
      call: { name: "execute-sql", input: { sql: "SELECT *" } },
    }))).toThrow();
  });

  it("persists only a bounded, audited, internally consistent successful trace", () => {
    const run = {
      schemaVersion: 1 as const,
      id: "e".repeat(32),
      disclosure,
      budget: aggregateAgentBudget,
      startedAt: "2026-07-17T08:00:00Z",
      finishedAt: "2026-07-17T08:00:10Z",
      turns: [
        {
          turn: 1,
          auditId: "f".repeat(32),
          action: "tool" as const,
          observation: {
            name: "rank" as const,
            input: { columnIndex: 1, direction: "descending" as const, limit: 3 },
            output: { ranked: [
              { rowIndex: 0, columnIndex: 1, value: 1200 },
              { rowIndex: 1, columnIndex: 1, value: 900 },
              { rowIndex: 2, columnIndex: 1, value: 600 },
            ] },
          },
        },
        { turn: 2, auditId: "1".repeat(32), action: "finish" as const },
      ],
      report,
    };
    expect(parseAggregateAgentRun(run)).toEqual(run);
    expect(() => parseAggregateAgentRun({
      ...run,
      turns: [{
        ...run.turns[0],
        observation: {
          ...run.turns[0]!.observation,
          output: { ranked: [{ rowIndex: 9, columnIndex: 1, value: 9999 }] },
        },
      }, run.turns[1]],
    })).toThrow("approved disclosure");
    expect(() => parseAggregateAgentRun({
      ...run,
      report: { ...report, findings: [{ ...report.findings[0], evidence: [{ rowIndex: 9, columnIndex: 1 }] }] },
    })).toThrow("disclosed cell");
  });
});
