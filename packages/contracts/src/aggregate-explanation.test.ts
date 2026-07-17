import { describe, expect, it } from "vitest";
import {
  parseAggregateDisclosure,
  parseAggregateExplanation,
  parseAggregateExplanationText,
  parseAggregateExplanationApproval,
  parseAggregateExplanationPreparation,
  parseAggregateExplanationProposal,
} from "./aggregate-explanation.js";

const disclosure = {
  schemaVersion: 1 as const,
  target: { kind: "dataset" as const, id: "a".repeat(32) },
  question: "各区域的销售额有什么值得关注？",
  purpose: "按区域汇总销售额",
  sourceCount: 1,
  columns: [
    { label: "Region", type: "text" as const },
    { label: "sum(Amount)", type: "real" as const },
    { label: "count(*)", type: "integer" as const },
  ],
  rows: [["North", 1200, 8], ["South", 900, 6]],
  truncated: false,
  minimumGroupSize: 5 as const,
};

describe("aggregate explanation contracts", () => {
  it("accepts only rectangular, bounded aggregate disclosures", () => {
    expect(parseAggregateDisclosure(disclosure)).toEqual(disclosure);
    expect(() => parseAggregateDisclosure({ ...disclosure, minimumGroupSize: 4 })).toThrow();
    expect(() => parseAggregateDisclosure({ ...disclosure, rows: [["North", 1200]] })).toThrow("width");
    expect(() => parseAggregateDisclosure({ ...disclosure, rows: Array.from({ length: 51 }, () => ["x", 1, 5]) })).toThrow();
  });

  it("uses a bounded opaque approval that cannot carry replacement data", () => {
    const proposal = {
      approvalToken: "b".repeat(64),
      expiresAt: "2026-07-17T08:10:00Z",
      destination: {
        providerId: "c".repeat(32),
        providerKind: "openai" as const,
        providerName: "Company model",
        model: "approved-model",
        endpointOrigin: "https://api.example.com",
      },
      disclosure,
    };
    expect(parseAggregateExplanationProposal(proposal)).toEqual(proposal);
    expect(() => parseAggregateExplanationProposal({
      ...proposal,
      destination: { ...proposal.destination, endpointOrigin: "https://user:secret@api.example.com/v1?key=x" },
    })).toThrow("origin");
    expect(parseAggregateExplanationApproval({ approvalToken: proposal.approvalToken })).toEqual({
      approvalToken: proposal.approvalToken,
    });
    expect(() => parseAggregateExplanationApproval({
      approvalToken: proposal.approvalToken,
      disclosure: { ...disclosure, rows: [["Injected", 1, 5]] },
    })).toThrow();
    const plan = {
      schemaVersion: 1 as const,
      datasetId: disclosure.target.id,
      versionId: "d".repeat(32),
      purpose: disclosure.purpose,
      dimensions: ["Region"],
      measures: [{ operation: "count" as const, column: null }],
      filters: [], sort: [], limit: 50,
    };
    expect(parseAggregateExplanationPreparation({ plan })).toEqual({ plan });
    expect(() => parseAggregateExplanationPreparation({ plan, result: disclosure })).toThrow();
  });

  it("rejects evidence references outside the exact disclosed cells", () => {
    const value = {
      schemaVersion: 1 as const,
      disclosure,
      summary: "North leads the disclosed regional totals.",
      findings: [{
        title: "North is highest",
        detail: "The disclosed North total exceeds South.",
        evidence: [{ rowIndex: 0, columnIndex: 1 }, { rowIndex: 1, columnIndex: 1 }],
      }],
      caveats: ["Only the approved aggregate result was analyzed."],
      nextQuestions: ["How has this changed over time?"],
    };
    expect(parseAggregateExplanation(value)).toEqual(value);
    expect(() => parseAggregateExplanation({
      ...value,
      findings: [{ ...value.findings[0], evidence: [{ rowIndex: 2, columnIndex: 1 }] }],
    })).toThrow("disclosed cell");
    const content = {
      schemaVersion: 1 as const,
      summary: value.summary,
      findings: value.findings,
      caveats: value.caveats,
      nextQuestions: value.nextQuestions,
    };
    expect(parseAggregateExplanationText(JSON.stringify(content), disclosure)).toEqual(value);
    expect(() => parseAggregateExplanationText(JSON.stringify({
      ...content,
      findings: [{ ...content.findings[0], evidence: [{ rowIndex: 9, columnIndex: 1 }] }],
    }), disclosure)).toThrow("disclosed cell");
  });
});
