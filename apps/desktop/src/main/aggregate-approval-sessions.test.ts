import { describe, expect, it } from "vitest";
import type { AggregateDisclosure } from "@bubu/contracts";
import { createAggregateApprovalSessionStore } from "./aggregate-approval-sessions.js";

const disclosure: AggregateDisclosure = {
  schemaVersion: 1,
  target: { kind: "dataset", id: "a".repeat(32) },
  question: "Explain",
  purpose: "Totals",
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
const outputTemplate = {
  schemaVersion: 1 as const, id: "builtin:explain-evidence", origin: "builtin" as const,
  scope: "aggregate-explanation" as const, name: "证据优先", description: "引用已批准证据", instruction: "先结论后证据。",
};

describe("aggregate approval sessions", () => {
  it("returns an exact preview and consumes its payload only once", () => {
    const store = createAggregateApprovalSessionStore({
      now: () => Date.parse("2026-07-17T08:00:00Z"),
      newToken: () => "c".repeat(64),
    });
    const proposal = store.issue(disclosure, destination, "a".repeat(32), outputTemplate);
    expect(proposal).toMatchObject({ disclosure, destination, promptTemplate: outputTemplate });
    expect(store.consume(proposal.approvalToken)).toEqual({ disclosure, destination, promptTemplate: outputTemplate, threadId: "a".repeat(32) });
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("expires approvals after ten minutes", () => {
    let now = Date.parse("2026-07-17T08:00:00Z");
    const store = createAggregateApprovalSessionStore({ now: () => now, newToken: () => "d".repeat(64) });
    const proposal = store.issue(disclosure, destination, "a".repeat(32), outputTemplate);
    now += 10 * 60 * 1_000 + 1;
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });

  it("revokes a preview when the user dismisses it", () => {
    const store = createAggregateApprovalSessionStore({ now: () => 1_000, newToken: () => "e".repeat(64) });
    const proposal = store.issue(disclosure, destination, "a".repeat(32), outputTemplate);
    store.revoke(proposal.approvalToken);
    expect(() => store.consume(proposal.approvalToken)).toThrow("expired or has already been used");
  });
});
