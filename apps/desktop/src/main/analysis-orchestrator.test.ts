import { describe, expect, it } from "vitest";
import type { ModelContext } from "@bubu/contracts";
import {
  buildGroupQueryPlanInvocation,
  buildQueryPlanInvocation,
  createGroupQueryPlanProposal,
  createQueryPlanProposal,
} from "./analysis-orchestrator.js";

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
  columns: [{ name: "Amount", type: "real", nullable: false, unique: false }],
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

describe("group analysis orchestration", () => {
  const secondContext: ModelContext = {
    datasetId: "d".repeat(32),
    versionId: "e".repeat(32),
    disclosure: "schema-synthetic",
    columns: [{ name: "Target", type: "real", nullable: false, unique: true }],
    syntheticRows: [[11.25], [21.25], [31.25]],
  };

  it("labels ordered contexts without adding local file or group metadata", () => {
    const invocation = buildGroupQueryPlanInvocation(
      { profile: provider, credential: "write-only-secret" },
      "f".repeat(32),
      [context, secondContext],
      "关联后对比",
    );
    expect(JSON.parse(invocation.user)).toMatchObject({
      groupId: "f".repeat(32),
      sources: [{ sourceIndex: 0, context }, { sourceIndex: 1, context: secondContext }],
    });
    expect(invocation.user).not.toContain("sourceName");
    expect(invocation.system).toContain("Never create a cross join");
  });

  it("rejects model plans that reorder disclosed group members", () => {
    const sources = [context, secondContext].map(({ datasetId, versionId }) => ({ datasetId, versionId }));
    const plan = {
      schemaVersion: 1,
      groupId: "f".repeat(32),
      purpose: "关联",
      sources,
      joins: [{ leftSourceIndex: 0, leftColumn: "Amount", rightSourceIndex: 1, rightColumn: "Target", type: "inner" }],
      dimensions: [{ sourceIndex: 0, column: "Amount" }],
      measures: [], filters: [], sort: [], limit: 50,
    };
    const completion = {
      providerId: provider.id, providerKind: provider.kind, model: provider.model,
      text: JSON.stringify(plan), usage: {},
    } as const;
    expect(createGroupQueryPlanProposal("关联", [context, secondContext], completion)).toMatchObject({ plan });
    expect(() => createGroupQueryPlanProposal("关联", [secondContext, context], completion)).toThrow("exactly match");
  });
});
