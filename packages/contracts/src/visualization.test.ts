import { describe, expect, it } from "vitest";
import { composeVisualizations, deriveVisualizationSpec, parseVisualizationComposition, parseVisualizationSpec, recommendVisualization } from "./visualization.js";

describe("local result visualization", () => {
  it("derives a bounded bar chart from a categorical aggregate", () => {
    const result = {
      columns: [{ label: "Region", type: "text" }, { label: "Sum", type: "real" }],
      rows: [["North", 30], ["South", 20]],
    } as const;
    expect(deriveVisualizationSpec(result, "区域金额")).toEqual({
      kind: "bar",
      title: "区域金额",
      categoryLabel: "Region",
      valueLabel: "Sum",
      points: [{ label: "North", value: 30 }, { label: "South", value: 20 }],
      omittedPointCount: 0,
    });
  });

  it("keeps high-cardinality time results as a complete table", () => {
    const rows = Array.from({ length: 22 }, (_, index) => [
      `2026-07-${String(index + 1).padStart(2, "0")}`,
      index === 3 ? "not-a-number" : index,
    ] as const);
    const recommendation = recommendVisualization({
      columns: [{ label: "Date", type: "datetime" }, { label: "Value", type: "real" }],
      rows,
    }, "趋势");
    expect(recommendation).toMatchObject({ kind: "table", reason: expect.stringContaining("21 个分类") });
  });

  it("does not invent a chart without a numeric series and rejects extra fields", () => {
    expect(deriveVisualizationSpec({
      columns: [{ label: "A", type: "text" }, { label: "B", type: "text" }],
      rows: [["x", "y"]],
    }, "No chart")).toBeUndefined();
    expect(() => parseVisualizationSpec({
      kind: "bar", title: "Chart", categoryLabel: "A", valueLabel: "B",
      points: [{ label: "x", value: 1 }], omittedPointCount: 0, html: "<script />",
    })).toThrow();
  });

  it("uses the last numeric output as the value series for numeric dimensions", () => {
    expect(deriveVisualizationSpec({
      columns: [{ label: "Year", type: "integer" }, { label: "Revenue", type: "real" }],
      rows: [[2025, 10], [2026, 20]],
    }, "Revenue by year")).toMatchObject({
      categoryLabel: "Year",
      valueLabel: "Revenue",
      points: [{ label: "2025", value: 10 }, { label: "2026", value: 20 }],
    });
  });

  it("composes up to four approved numeric metrics over one unique dimension", () => {
    const composition = composeVisualizations({
      columns: [{ label: "Region", type: "text" }, { label: "Revenue", type: "real" }, { label: "Orders", type: "integer" }],
      rows: [["North", 30, 3], ["South", 20, 2]],
    }, "区域经营");
    expect(composition).toMatchObject({
      kind: "charts",
      composition: { views: [{ valueLabel: "Revenue" }, { valueLabel: "Orders" }] },
    });
    if (composition.kind === "charts") expect(parseVisualizationComposition(composition.composition)).toEqual(composition.composition);
  });

  it("fails multi-view composition closed for repeated dimensions", () => {
    expect(composeVisualizations({
      columns: [{ label: "Region", type: "text" }, { label: "Revenue", type: "real" }],
      rows: [["North", 30], ["North", 20]],
    }, "区域经营")).toMatchObject({ kind: "table", reason: expect.stringContaining("未经计划批准的聚合") });
  });
});
