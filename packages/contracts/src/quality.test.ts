import { describe, expect, it } from "vitest";
import { parseDatasetQualityReport, parseDatasetValidationSaveInput } from "./quality.js";

const datasetId = "a".repeat(32);

describe("local data quality contracts", () => {
  it("accepts bounded deterministic rules and rejects impossible ranges", () => {
    const input = {
      datasetId,
      rules: [
        { kind: "required", column: "Order" },
        { kind: "unique", column: "Order" },
        { kind: "number-range", column: "Amount", minimum: 0, maximum: 1_000 },
        { kind: "pattern", column: "Order", pattern: "^[A-Z]-[0-9]+$" },
        { kind: "allowed-values", column: "Region", values: ["North", "South"] },
      ],
    } as const;
    expect(parseDatasetValidationSaveInput(input)).toEqual(input);
    expect(() => parseDatasetValidationSaveInput({
      datasetId,
      rules: [{ kind: "number-range", column: "Amount", minimum: 10, maximum: 1 }],
    })).toThrow();
    expect(() => parseDatasetValidationSaveInput({
      datasetId,
      rules: [{ kind: "allowed-values", column: "Region", values: ["North", "North"] }],
    })).toThrow();
  });

  it("parses a bounded local report without raw failing values", () => {
    const report = {
      datasetId,
      versionId: "b".repeat(32),
      rowCount: 2,
      score: 90,
      columns: [{
        name: "Region",
        inferredType: "text",
        rowCount: 2,
        nullCount: 0,
        nullRate: 0,
        distinctCount: 2,
        distinctRate: 1,
        minValue: "North",
        maxValue: "South",
      }],
      findings: [{ kind: "candidate-key", severity: "info", column: "Region" }],
      rules: [{ kind: "allowed-values", column: "Region", values: ["North"] }],
      validation: [{
        ruleIndex: 0,
        kind: "allowed-values",
        column: "Region",
        failedRows: 1,
        sampleRowNumbers: [2],
      }],
    } as const;
    expect(parseDatasetQualityReport(report)).toEqual(report);
    expect(() => parseDatasetQualityReport({ ...report, failingValues: ["South"] })).toThrow();
  });
});
