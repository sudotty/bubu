import { describe, expect, it } from "vitest";
import type { ModelContext } from "@bubu/contracts";
import { buildQueryPlanInvocation, createQueryPlanProposal } from "./analysis-orchestrator.js";

const provider = {
  id: "a".repeat(32),
  name: "Model",
  kind: "openai",
  baseUrl: "https://api.openai.com/v1/",
  model: "configured-model",
} as const;
const context: ModelContext = {
  datasetId: "b".repeat(32),
  versionId: "c".repeat(32),
  disclosure: "schema-synthetic",
  columns: [{ name: "Amount", type: "real", nullable: false }],
  syntheticRows: [[10.25], [20.25], [30.25]],
};

describe("analysis orchestration", () => {
  it("sends only the explicit question and disclosed model context", () => {
    const invocation = buildQueryPlanInvocation(
      { profile: provider, credential: "write-only-secret" },
      context,
      "总金额是多少？",
    );
    expect(JSON.parse(invocation.user)).toEqual({ question: "总金额是多少？", context });
    expect(invocation.system).toContain("Do not use Markdown");
    expect(invocation.system).toContain("or SQL");
    expect(invocation.user).not.toContain("sourceName");
  });

  it("accepts only a strict plan for the disclosed immutable version", () => {
    const plan = {
      schemaVersion: 1,
      datasetId: context.datasetId,
      versionId: context.versionId,
      purpose: "计算总金额",
      dimensions: [],
      measures: [{ operation: "sum", column: "Amount" }],
      filters: [],
      sort: [],
      limit: 50,
    };
    expect(
      createQueryPlanProposal("总金额是多少？", context, {
        providerId: provider.id,
        providerKind: provider.kind,
        model: provider.model,
        text: JSON.stringify(plan),
        usage: {},
      }),
    ).toMatchObject({ plan });

    expect(() =>
      createQueryPlanProposal("总金额是多少？", context, {
        providerId: provider.id,
        providerKind: provider.kind,
        model: provider.model,
        text: JSON.stringify({ ...plan, versionId: "d".repeat(32) }),
        usage: {},
      }),
    ).toThrow("disclosed dataset version");
  });
});
