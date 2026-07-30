import { describe, expect, it } from "vitest";
import { recommendFileArrivalTargets } from "./file-arrival.js";

const dataset = (id: string, displayName: string, sourceName: string, sourceKind: "csv" | "xlsx" = "csv") => ({
  id, versionId: id, displayName, sourceName, sourceKind, rowCount: 1, columnCount: 1, importedAt: "2026-07-27T00:00:00.000Z", version: 1,
});

describe("file arrival target policy", () => {
  it("prefers exact historical source identity", () => {
    const result = recommendFileArrivalTargets("sales.csv", [dataset("a".repeat(32), "Weekly Sales", "sales.csv"), dataset("b".repeat(32), "Other", "other.csv")]);
    expect(result[0]).toMatchObject({ datasetId: "a".repeat(32), reason: "source-name", confidence: "high" });
  });

  it("does not auto-resolve ambiguous weak matches", () => {
    const result = recommendFileArrivalTargets("weekly.csv", [dataset("a".repeat(32), "Weekly Sales", "a.csv"), dataset("b".repeat(32), "Weekly Refunds", "b.csv")]);
    expect(result).toHaveLength(2);
    expect(result.every(({ confidence }) => confidence !== "high")).toBe(true);
  });

  it("never recommends an incompatible source kind", () => {
    expect(recommendFileArrivalTargets("sales.xlsx", [dataset("a".repeat(32), "Sales", "sales.csv")])).toEqual([]);
  });

  it("uses authoritative schema and bounded row profile to strengthen or demote a candidate", () => {
    const datasets = [dataset("a".repeat(32), "Sales", "sales.csv")];
    expect(recommendFileArrivalTargets("sales.csv", datasets, { sourceKind: "csv", tables: [{ sheetName: "", columns: ["Order", "Amount"], rowCount: 2 }] }, [{ datasetId: "a".repeat(32), columns: ["Order", "Amount"], rowCount: 3 }])[0]).toMatchObject({ reason: "schema-profile", confidence: "high" });
    expect(recommendFileArrivalTargets("sales.csv", datasets, { sourceKind: "csv", tables: [{ sheetName: "", columns: ["Other"], rowCount: 2 }] }, [{ datasetId: "a".repeat(32), columns: ["Order", "Amount"], rowCount: 3 }])[0]).toMatchObject({ reason: "source-name", confidence: "medium" });
  });
});
