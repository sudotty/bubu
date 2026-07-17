import { describe, expect, it } from "vitest";
import type { DatasetSummary } from "@bubu/contracts";
import { datasetExportFileName } from "./dataset-lifecycle-api.js";

const dataset: DatasetSummary = {
  id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  versionId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  displayName: "Q3: Sales / APAC. ",
  sourceName: "sales.csv",
  sourceKind: "csv",
  version: 4,
  rowCount: 20,
  columnCount: 3,
  importedAt: "2026-07-17T00:00:00Z",
};

describe("dataset export filename", () => {
  it("removes Windows and path control characters", () => {
    expect(datasetExportFileName(dataset)).toBe("Q3- Sales - APAC-v4.csv");
  });

  it("uses a non-empty local fallback", () => {
    expect(datasetExportFileName({ ...dataset, displayName: "..." })).toBe("dataset-v4.csv");
  });
});
