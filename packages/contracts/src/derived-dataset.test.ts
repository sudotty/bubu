import { describe, expect, it } from "vitest";
import { parseDataCleanProposal, parseDerivedDatasetCreateInput, parseDerivedDatasetLineage, parseDerivedRecomputeEvent } from "./derived-dataset.js";

const id = "a".repeat(32);

describe("derived dataset contracts", () => {
  it("accepts a typed dataset-query transformation without SQL or code", () => {
    const input = {
      displayName: "区域销售摘要",
      transformation: {
        kind: "dataset-query",
        plan: {
          schemaVersion: 1,
          datasetId: id,
          versionId: "b".repeat(32),
          purpose: "按区域汇总销售额",
          dimensions: ["Region"],
          measures: [{ operation: "sum", column: "Revenue" }],
          filters: [],
          sort: [],
          limit: 50,
        },
      },
    } as const;
    expect(parseDerivedDatasetCreateInput(input)).toEqual(input);
  });

  it("rejects model SQL and unknown execution fields", () => {
    expect(() => parseDerivedDatasetCreateInput({
      displayName: "unsafe",
      transformation: { kind: "dataset-query", plan: { sql: "DROP TABLE datasets" } },
    })).toThrow();
  });

  it("accepts the complete bounded data-clean grammar", () => {
    const input = {
      displayName: "规范订单",
      transformation: {
        kind: "data-clean",
        cleanPlan: {
          schemaVersion: 1,
          purpose: "清理并合并周订单",
          sources: [{ datasetId: id, versionId: "b".repeat(32) }, { datasetId: "c".repeat(32), versionId: "d".repeat(32) }],
          operations: [
            { kind: "select", columns: ["Order ID", "Amount", "Region"] },
            { kind: "rename", column: "Order ID", name: "OrderId" },
            { kind: "cast", column: "Amount", to: "real", onInvalid: "reject" },
            { kind: "replace", column: "Region", match: " north ", replacement: "North", mode: "normalized-text" },
            { kind: "derive", name: "Gross", expression: { kind: "arithmetic", operator: "multiply", leftColumn: "Amount", rightColumn: "Amount", onInvalid: "null", divideByZero: "reject" } },
            { kind: "filter", predicate: { column: "Amount", operator: "greater-than", value: 0 } },
            { kind: "deduplicate", keys: ["OrderId"], keep: "last" },
            { kind: "fill-missing", column: "Amount", fill: { strategy: "mean" } },
            { kind: "append", sourceIndex: 1 },
            { kind: "union", sourceIndex: 1, mapping: [{ source: "Order ID", target: "OrderId" }] },
          ],
        },
      },
    } as const;
    expect(parseDerivedDatasetCreateInput(input)).toEqual(input);
  });

  it("rejects unknown operations, duplicate sources, and unavailable source indexes", () => {
    const base = {
      schemaVersion: 1,
      purpose: "clean",
      sources: [{ datasetId: id, versionId: "b".repeat(32) }],
    } as const;
    expect(() => parseDerivedDatasetCreateInput({ displayName: "unsafe", transformation: { kind: "data-clean", cleanPlan: { ...base, operations: [{ kind: "sql", value: "DROP TABLE datasets" }] } } })).toThrow();
    expect(() => parseDerivedDatasetCreateInput({ displayName: "duplicate", transformation: { kind: "data-clean", cleanPlan: { ...base, sources: [...base.sources, ...base.sources], operations: [{ kind: "select", columns: ["A"] }] } } })).toThrow("unique");
    expect(() => parseDerivedDatasetCreateInput({ displayName: "missing", transformation: { kind: "data-clean", cleanPlan: { ...base, operations: [{ kind: "append", sourceIndex: 1 }] } } })).toThrow("unavailable");
  });

  it("parses a version-bound one-use impact proposal without accepting extra fields", () => {
    const qualityPolicy = { schemaVersion: 1 as const, rules: [{ id: "output-has-rows", severity: "blocking" as const, kind: "row-count" as const, minimum: 1 }] };
    const request = { displayName: "规范订单", cleanPlan: { schemaVersion: 1 as const, purpose: "订单去重", sources: [{ datasetId: id, versionId: "b".repeat(32) }], operations: [{ kind: "deduplicate" as const, keys: ["Order ID"], keep: "first" as const }] }, qualityPolicy };
    const impact = { planFingerprint: "c".repeat(64), sources: [{ datasetId: id, versionId: "b".repeat(32), displayName: "订单", rowCount: 3, columns: ["Order ID"] }], resultRowCount: 2, resultColumns: ["Order ID"], operations: [{ ordinal: 1, kind: "deduplicate", beforeRowCount: 3, afterRowCount: 2, beforeColumnCount: 1, afterColumnCount: 1, beforeColumns: ["Order ID"], afterColumns: ["Order ID"], affectedRowCount: 1 }] };
    const quality = { policyFingerprint: "e".repeat(64), status: "passed" as const, results: [{ ruleId: "output-has-rows", severity: "blocking" as const, kind: "row-count" as const, passed: true, failedRows: 0, observed: "2 rows", expected: "at least 1", sampleRowNumbers: [] }] };
    expect(parseDataCleanProposal({ approvalToken: "d".repeat(64), expiresAt: "2026-07-26T08:00:00.000Z", request, impact, quality })).toMatchObject({ request, impact, quality });
    expect(() => parseDataCleanProposal({ approvalToken: "d".repeat(64), expiresAt: "2026-07-26T08:00:00.000Z", request, impact: { ...impact, sql: "select *" }, quality })).toThrow();
  });

  it("requires strict version execution evidence in lineage", () => {
    const cleanImpact = { planFingerprint: "c".repeat(64), sources: [{ datasetId: id, versionId: "b".repeat(32), displayName: "订单", rowCount: 3, columns: ["Order ID"] }], resultRowCount: 2, resultColumns: ["Order ID"], operations: [{ ordinal: 1, kind: "deduplicate", beforeRowCount: 3, afterRowCount: 2, beforeColumnCount: 1, afterColumnCount: 1, beforeColumns: ["Order ID"], afterColumns: ["Order ID"], affectedRowCount: 1 }] };
    const lineage = { datasetId: id, versionId: "b".repeat(32), transformationKind: "data-clean", purpose: "订单去重", planFingerprint: "c".repeat(64), executionEvidence: { executionId: "d".repeat(32), reviewKind: "one-use-approval", qualityGateStatus: "not-configured", warnings: [], cleanImpact, quality: null }, parents: [{ ordinal: 0, datasetId: "e".repeat(32), versionId: "f".repeat(32), displayName: "订单" }], createdAt: "2026-07-26T08:00:00.000Z" };
    expect(parseDerivedDatasetLineage(lineage)).toEqual(lineage);
    expect(() => parseDerivedDatasetLineage({ ...lineage, executionEvidence: { ...lineage.executionEvidence, reviewKind: "unreviewed" } })).toThrow();
  });

  it("requires recompute status and execution evidence to agree", () => {
    const event = { id, sourceDatasetId: "b".repeat(32), sourceVersionId: "c".repeat(32), targetDatasetId: "d".repeat(32), targetDisplayName: "规范订单", status: "paused", reasonKind: "quality-block", error: "quality gate blocked", resultVersionId: null, attempt: 1, createdAt: "2026-07-27T00:00:00Z", startedAt: "2026-07-27T00:00:01Z", finishedAt: "2026-07-27T00:00:02Z" } as const;
    expect(parseDerivedRecomputeEvent(event)).toEqual(event);
    expect(() => parseDerivedRecomputeEvent({ ...event, resultVersionId: "e".repeat(32) })).toThrow("diagnostic evidence");
    expect(() => parseDerivedRecomputeEvent({ ...event, status: "pending" })).toThrow("Pending recomputes");
  });
});
