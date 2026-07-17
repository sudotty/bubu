import { describe, expect, it } from "vitest";
import { aggregateAgentBudget, type AggregateDisclosure } from "@bubu/contracts";
import { createAggregateApprovalSessionStore } from "./aggregate-approval-sessions.js";
import { createAggregateAgentApprovalSessionStore } from "./aggregate-agent-approval-sessions.js";

const disclosure: AggregateDisclosure = {
  schemaVersion: 1,
  target: { kind: "dataset", id: "a".repeat(32) },
  question: "Verify the important differences",
  purpose: "Regional totals",
  sourceCount: 1,
  columns: [{ label: "Total", type: "real" }, { label: "count(*)", type: "integer" }],
  rows: [[100, 8]],
  truncated: false,
  minimumGroupSize: 5,
};

const destination = {
  providerId: "b".repeat(32),
  providerKind: "openai" as const,
  providerName: "Company model",
  model: "approved-model",
  endpointOrigin: "https://api.example.com",
};

describe("aggregate agent approval sessions", () => {
  it("binds and consumes the exact disclosure, destination, and immutable budget once", () => {
    const store = createAggregateAgentApprovalSessionStore({
      now: () => Date.parse("2026-07-17T08:00:00Z"),
      newToken: () => "c".repeat(64),
    });
    const proposal = store.issue(disclosure, destination);
    expect(proposal).toMatchObject({ disclosure, destination, budget: aggregateAgentBudget });
    expect(store.consume(proposal.approvalToken)).toEqual({
      disclosure,
      destination,
      budget: aggregateAgentBudget,
    });
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("expires, revokes, and remains isolated from another capability store", () => {
    let now = 1_000;
    const store = createAggregateAgentApprovalSessionStore({ now: () => now, newToken: () => "d".repeat(64) });
    const explanationStore = createAggregateApprovalSessionStore({
      now: () => now,
      newToken: () => "e".repeat(64),
    });
    const proposal = store.issue(disclosure, destination);
    const explanationProposal = explanationStore.issue(disclosure, destination);
    expect(() => explanationStore.consume(proposal.approvalToken)).toThrow("expired or has already been used");
    expect(() => store.consume(explanationProposal.approvalToken)).toThrow("expired or has already been used");
    store.revoke(proposal.approvalToken);
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");

    const expiring = store.issue(disclosure, destination);
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consume(expiring.approvalToken)).toThrow("expired or has already been used");
  });
});
