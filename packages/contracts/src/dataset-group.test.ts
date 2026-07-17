import { describe, expect, it } from "vitest";
import { parseDatasetGroup, parseDatasetGroupSaveInput } from "./dataset-group.js";

const dataset = (id: string, name: string) => ({
  id,
  versionId: id.replaceAll("a", "c").replaceAll("b", "d"),
  displayName: name,
  sourceKind: "csv",
  sourceName: `${name}.csv`,
  rowCount: 2,
  columnCount: 3,
  importedAt: "2026-07-17T00:00:00Z",
  version: 1,
});

describe("dataset group boundary", () => {
  it("requires two through eight unique data contacts", () => {
    const datasetIds = ["a".repeat(32), "b".repeat(32)];
    expect(parseDatasetGroupSaveInput({ name: "销售群", datasetIds })).toEqual({ name: "销售群", datasetIds });
    expect(() => parseDatasetGroupSaveInput({ name: "销售群", datasetIds: [datasetIds[0]] })).toThrow();
    expect(() => parseDatasetGroupSaveInput({ name: "销售群", datasetIds: [datasetIds[0], datasetIds[0]] })).toThrow("unique");
  });

  it("returns current immutable members without accepting hidden fields", () => {
    const value = {
      id: "e".repeat(32),
      name: "销售群",
      members: [dataset("a".repeat(32), "sales"), dataset("b".repeat(32), "targets")],
      createdAt: "2026-07-17T00:00:00Z",
      updatedAt: "2026-07-17T00:00:00Z",
    };
    expect(parseDatasetGroup(value)).toMatchObject({ name: "销售群" });
    expect(() => parseDatasetGroup({ ...value, cloudShared: true })).toThrow();
  });
});
