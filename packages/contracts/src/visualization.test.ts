import { describe, expect, it } from "vitest";
import { deriveVisualizationSpec, parseVisualizationSpec } from "./visualization.js";

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

  it("derives a line chart for time and omits invalid/overflow points", () => {
    const rows = Array.from({ length: 22 }, (_, index) => [
      `2026-07-${String(index + 1).padStart(2, "0")}`,
      index === 3 ? "not-a-number" : index,
    ] as const);
    const spec = deriveVisualizationSpec({
      columns: [{ label: "Date", type: "datetime" }, { label: "Value", type: "real" }],
      rows,
    }, "趋势");
    expect(spec?.kind).toBe("line");
    expect(spec?.points).toHaveLength(20);
    expect(spec?.omittedPointCount).toBe(1);
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
});
