import { describe, expect, it } from "vitest";
import {
  parseDatasetImportResult,
  parseDatasetPreviewRequest,
  parseDatasetReplacementResult,
  parseDatasetReplacementMappingInput,
  parseDatasetReplacementSelectionResult,
  parseDatasetSummary,
} from "./dataset.js";

const summary = {
  id: "a".repeat(32),
  versionId: "b".repeat(32),
  displayName: "Sales",
  sourceKind: "csv",
  sourceName: "sales.csv",
  rowCount: 2,
  columnCount: 3,
  importedAt: "2026-07-17T10:00:00Z",
  version: 1,
};

describe("dataset boundary", () => {
  it("parses a local dataset summary without a source path", () => {
    expect(parseDatasetSummary(summary)).toEqual(summary);
    expect(() => parseDatasetSummary({ ...summary, sourcePath: "/private/sales.csv" })).toThrow();
  });

  it("parses an import result and an explicit canceled selection", () => {
    expect(parseDatasetImportResult({ datasets: [summary] })).toEqual({ datasets: [summary] });
    expect(parseDatasetImportResult({ datasets: [] })).toEqual({ datasets: [] });
  });

  it("applies bounded preview defaults and rejects malformed ids", () => {
    expect(parseDatasetPreviewRequest({ datasetId: summary.id })).toEqual({
      datasetId: summary.id,
      limit: 50,
      offset: 0,
    });
    expect(() => parseDatasetPreviewRequest({ datasetId: "../secrets", limit: 50 })).toThrow();
    expect(() => parseDatasetPreviewRequest({ datasetId: summary.id, limit: 501 })).toThrow();
  });

  it("parses replacement outcomes without accepting a source path", () => {
    expect(parseDatasetReplacementResult({ status: "replaced", dataset: { ...summary, version: 2 } })).toEqual({
      status: "replaced",
      dataset: { ...summary, version: 2 },
    });
    const mappingRequired = {
      status: "mapping-required",
      drift: {
        currentColumns: ["Order", "Amount"],
        incomingColumns: ["Order", "Total"],
        missingColumns: ["Amount"],
        addedColumns: ["Total"],
        reordered: false,
      },
    } as const;
    expect(parseDatasetReplacementResult(mappingRequired)).toEqual(mappingRequired);
    expect(() =>
      parseDatasetReplacementResult({ ...mappingRequired, sourcePath: "/private/drifted.csv" }),
    ).toThrow();
  });

  it("requires a one-shot token and strict column pairs for interactive mapping", () => {
    const input = {
      replacementToken: "c".repeat(32),
      mappings: [
        { currentColumn: "Order", incomingColumn: "Order Number" },
        { currentColumn: "Amount", incomingColumn: "Total" },
      ],
    };
    expect(parseDatasetReplacementMappingInput(input)).toEqual(input);
    expect(() => parseDatasetReplacementMappingInput({ ...input, sourcePath: "/private/week-2.csv" })).toThrow();
    expect(() => parseDatasetReplacementMappingInput({ ...input, replacementToken: "expired" })).toThrow();

    const selection = {
      status: "mapping-required",
      replacementToken: "d".repeat(32),
      drift: {
        currentColumns: ["Order", "Amount"],
        incomingColumns: ["Order Number", "Total"],
        missingColumns: ["Order", "Amount"],
        addedColumns: ["Order Number", "Total"],
        reordered: false,
      },
    } as const;
    expect(parseDatasetReplacementSelectionResult(selection)).toEqual(selection);
    expect(() => parseDatasetReplacementSelectionResult({ ...selection, sourcePath: "/private/week-2.csv" })).toThrow();
  });
});
