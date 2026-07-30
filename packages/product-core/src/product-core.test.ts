import { describe, expect, it } from "vitest";
import { parseProviderConfigurationInput, parsePromptTemplateRegistry, type DataCleanPlan } from "@bubu/contracts";
import { canonicalDataCleanPlan, canonicalReconciliationPlan, dataCleanTemplateById, dataCleanTemplates, emptyPromptTemplateRegistry, emptyWorkspaceTaskStarters, previewComparisonCardinality, providerPresetById, providerPresets, promptTemplatesFor, removeCustomPromptTemplate, resolvePromptTemplate, selectPromptTemplate, summarizeDataCleanPlan, taskStartersFor, upsertCustomPromptTemplate } from "./index.js";

describe("product core", () => {
  it("keeps provider presets unique and boundary-valid", () => {
    expect(new Set(providerPresets.map(({ id }) => id)).size).toBe(providerPresets.length);
    for (const preset of providerPresets) expect(parseProviderConfigurationInput({ name: preset.name, kind: preset.kind, baseUrl: preset.baseUrl, model: preset.model })).toMatchObject({ kind: preset.kind });
    expect(providerPresetById("deepseek-fast")).toMatchObject({ kind: "openai-compatible", baseUrl: "https://api.deepseek.com/" });
  });

  it("keeps task starters bounded to implemented plan language", () => {
    for (const kind of ["dataset", "group"] as const) for (const starter of taskStartersFor(kind)) expect(starter.question).not.toMatch(/发送通知|写入|删除|预测|联网/u);
  });

  it("keeps empty-workspace tasks truthful and actionable only when implemented", () => {
    expect(emptyWorkspaceTaskStarters.map(({ id }) => id)).toEqual(["clean", "analyze", "repeat", "compare", "reconcile", "merge"]);
    expect(emptyWorkspaceTaskStarters.filter(({ status }) => status === "planned")).toEqual([]);
    expect(emptyWorkspaceTaskStarters.find(({ id }) => id === "merge")).toMatchObject({ status: "implemented", actionLabel: "打开周期导出 Merge" });
    for (const task of emptyWorkspaceTaskStarters) {
      if (task.status === "implemented") expect(task.actionLabel).toBeTruthy();
      else expect("actionLabel" in task).toBe(false);
    }
  });

  it("resolves a saved custom prompt or a safe built-in default", () => {
    const custom = { schemaVersion: 1, id: "a".repeat(32), origin: "custom", scope: "dataset-query", name: "经营周报", description: "突出规模和趋势", instruction: "优先按时间汇总。" } as const;
    const registry = parsePromptTemplateRegistry({ schemaVersion: 1, customTemplates: [custom], selected: { datasetQuery: custom.id } });
    expect(promptTemplatesFor("dataset-query", registry)).toHaveLength(3);
    expect(resolvePromptTemplate("dataset-query", custom)).toEqual(custom);
    expect(resolvePromptTemplate("group-query", custom).id).toBe("builtin:group-lookup");
    const saved = upsertCustomPromptTemplate(emptyPromptTemplateRegistry, custom);
    const selected = selectPromptTemplate(saved, "dataset-query", custom.id);
    expect(selected.selected.datasetQuery).toBe(custom.id);
    expect(removeCustomPromptTemplate(selected, custom.id)).toEqual(emptyPromptTemplateRegistry);
  });

  it("summarizes clean-plan value and risk without executing it", () => {
    const plan: DataCleanPlan = {
      schemaVersion: 1,
      purpose: "规范订单",
      sources: [{ datasetId: "a".repeat(32), versionId: "b".repeat(32) }],
      operations: [
        { kind: "select", columns: ["Order ID", "Amount"] },
        { kind: "cast", column: "Amount", to: "real", onInvalid: "reject" },
        { kind: "filter", predicate: { column: "Amount", operator: "greater-than", value: 0 } },
      ],
    };
    expect(summarizeDataCleanPlan(plan)).toMatchObject({ sourceCount: 1, operationCount: 3, risks: ["drops-columns", "lossy-cast", "drops-rows"] });
    expect(canonicalDataCleanPlan(plan)).toBe(canonicalDataCleanPlan({ ...plan, purpose: "规范订单" }));
    expect(canonicalDataCleanPlan(plan)).not.toContain("sql");
  });

  it("offers bounded templates for recurring single- and multi-source cleanup", () => {
    expect(dataCleanTemplates.map(({ id }) => id)).toEqual(["monthly-prep", "customer-dedup", "order-normalization", "append-exports", "reference-mapping"]);
    expect(new Set(dataCleanTemplates.map(({ id }) => id)).size).toBe(dataCleanTemplates.length);
    expect(dataCleanTemplateById("append-exports")).toMatchObject({ mode: "append", needsSecondSource: true });
    expect(dataCleanTemplateById("reference-mapping")).toMatchObject({ mode: "reference-check", needsSecondSource: true });
  });

  it("fails comparison cardinality closed before execution", () => {
    const comparison = { schemaVersion: 1 as const, purpose: "订单付款核对", sources: { left: { datasetId: "a".repeat(32), versionId: "b".repeat(32) }, right: { datasetId: "c".repeat(32), versionId: "d".repeat(32) } }, match: { keys: [{ leftColumn: "Order ID", rightColumn: "Order ID", normalization: ["trim" as const] }], cardinality: "one-to-one" as const }, budgets: { maximumCandidatePairs: 4, timeoutMs: 1_000 } };
    expect(previewComparisonCardinality(comparison, [{ key: "1", count: 2 }, { key: "2", count: 1 }], [{ key: "1", count: 3 }, { key: "2", count: 1 }])).toEqual({ candidatePairs: 6, duplicateLeftRows: 2, duplicateRightRows: 3, withinBudget: false, cardinalityAllowed: false });
    expect(canonicalReconciliationPlan({ schemaVersion: 1, purpose: "订单付款对账", comparison, controlTotals: [{ id: "gross", leftColumn: "Amount", rightColumn: "Paid", aggregation: "sum", tolerance: 0.01 }], unresolvedPolicy: "review-required" })).not.toMatch(/sql|code|fuzzy/iu);
  });
});
