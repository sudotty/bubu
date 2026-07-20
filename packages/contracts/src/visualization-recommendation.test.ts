import { describe, expect, it } from "vitest";
import { recommendVisualization } from "./visualization.js";

describe("recommendVisualization", () => {
  it("uses a chronologically sorted line only for parseable time categories", () => {
    const result = recommendVisualization({ columns: [{ label: "day", type: "datetime" }, { label: "sales", type: "real" }], rows: [["2026-02-01", 2], ["2026-01-01", 1]] }, "趋势");
    expect(result.kind).toBe("chart");
    if (result.kind === "chart") expect(result.spec).toMatchObject({ kind: "line", points: [{ label: "2026-01-01" }, { label: "2026-02-01" }] });
  });

  it("refuses charts that would hide cardinality or imply new aggregation", () => {
    const columns = [{ label: "category", type: "text" }, { label: "value", type: "integer" }] as const;
    expect(recommendVisualization({ columns, rows: [["A", 1], ["A", 2]] }, "重复")).toMatchObject({ kind: "table", reason: expect.stringContaining("未经计划批准") });
    expect(recommendVisualization({ columns, rows: Array.from({ length: 21 }, (_, index) => [`C${index}`, index]) }, "过多")).toMatchObject({ kind: "table", reason: expect.stringContaining("21 个分类") });
  });
});
