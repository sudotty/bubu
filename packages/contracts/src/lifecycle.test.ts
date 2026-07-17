import { describe, expect, it } from "vitest";
import { parseDatasetDeletionResult, parseDatasetExportResult } from "./lifecycle.js";

describe("dataset lifecycle boundary", () => {
  it("returns export metadata without an absolute output path", () => {
    const result = {
      status: "exported",
      datasetId: "a".repeat(32),
      versionId: "b".repeat(32),
      fileName: "sales-safe.csv",
      rowCount: 2,
      mode: "excel-safe",
    } as const;
    expect(parseDatasetExportResult(result)).toEqual(result);
    expect(() => parseDatasetExportResult({ ...result, fileName: "/private/sales.csv" })).toThrow();
    expect(() => parseDatasetExportResult({ ...result, outputPath: "/private/sales.csv" })).toThrow();
  });

  it("reports all group lifecycle effects of a permanent deletion", () => {
    const result = {
      status: "deleted",
      datasetId: "c".repeat(32),
      removedGroupIds: ["d".repeat(32)],
      updatedGroupIds: ["e".repeat(32)],
    } as const;
    expect(parseDatasetDeletionResult(result)).toEqual(result);
    expect(() => parseDatasetDeletionResult({ ...result, recoverable: true })).toThrow();
  });
});
