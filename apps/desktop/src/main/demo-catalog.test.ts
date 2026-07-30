import type { DatasetSummary } from "@bubu/contracts";
import { describe, expect, it, vi } from "vitest";
import { createDemoWorkspace, resolveDemoWorkspace, type DemoWorkspaceStore } from "./demo-catalog.js";

const importedAt = "2026-07-24T00:00:00.000Z";
const ids = ["1".repeat(32), "2".repeat(32), "3".repeat(32)] as const;

function dataset(id: string, sourceName: string): DatasetSummary {
  return {
    id,
    versionId: id.replace(/./gu, "a"),
    displayName: sourceName,
    sourceKind: "csv",
    sourceName,
    rowCount: 4,
    columnCount: 3,
    importedAt,
    version: 1,
  };
}

const importedDatasets = [
  dataset(ids[0], "retail-orders.csv"),
  dataset(ids[1], "retail-targets.csv"),
  dataset(ids[2], "retail-customers.csv"),
] as const;

describe("bundled demo workspace", () => {
  it("resolves one bounded retail workspace without exposing arbitrary paths", () => {
    expect(resolveDemoWorkspace("retail-operations", "/Applications/BuBu.app/Contents/Resources/demo")).toEqual({
      id: "retail-operations",
      name: "零售经营周报",
      files: [
        "/Applications/BuBu.app/Contents/Resources/demo/retail-orders.csv",
        "/Applications/BuBu.app/Contents/Resources/demo/retail-targets.csv",
        "/Applications/BuBu.app/Contents/Resources/demo/retail-customers.csv",
      ],
    });
    expect(() => resolveDemoWorkspace("../../private", "/Applications/BuBu.app/Contents/Resources/demo")).toThrow();
  });

  it("resolves the two bounded reconciliation cases", () => {
    expect(resolveDemoWorkspace("reconciliation-cases", "/demo")).toEqual({
      id: "reconciliation-cases", name: "销售退款与订单付款对账",
      files: ["/demo/reconcile-sales.csv", "/demo/reconcile-refunds.csv", "/demo/reconcile-orders.csv", "/demo/reconcile-payments.csv"],
    });
  });

  it("resolves the bounded same-schema merge exports", () => {
    expect(resolveDemoWorkspace("merge-exports", "/demo")).toEqual({
      id: "merge-exports", name: "周期订单合并",
      files: ["/demo/merge-week-1.csv", "/demo/merge-week-2.csv", "/demo/merge-week-3.csv"],
    });
  });

  it("creates the named objects, confirmed relationships, and weekly business topic", async () => {
    const renamed: DatasetSummary[] = [];
    const saveRelationship = vi.fn<DemoWorkspaceStore["saveDatasetRelationship"]>(async (input) => ({
      id: "b".repeat(32),
      kind: "lookup",
      ...input,
      status: "ready",
      issue: null,
      createdAt: importedAt,
    }));
    const store: DemoWorkspaceStore = {
      listDatasets: async () => [],
      importFiles: async () => ({ datasets: [...importedDatasets] }),
      renameDataset: async ({ datasetId, displayName }) => {
        const value = { ...importedDatasets.find(({ id }) => id === datasetId)!, displayName };
        renamed.push(value);
        return value;
      },
      saveDatasetRelationship: saveRelationship,
      saveGroup: async (input) => ({
        id: "c".repeat(32),
        name: input.name,
        description: input.description,
        cadence: input.cadence,
        members: renamed,
        createdAt: importedAt,
        updatedAt: importedAt,
      }),
      deleteDataset: async (datasetId) => ({
        status: "deleted",
        datasetId,
        removedGroupIds: [],
        updatedGroupIds: [],
      }),
    };

    const result = await createDemoWorkspace("retail-operations", "/demo", store);

    expect(result.datasets.map(({ displayName }) => displayName)).toEqual(["零售订单", "区域目标", "客户档案"]);
    expect(result.group).toMatchObject({ name: "零售经营周报", cadence: "weekly" });
    expect(saveRelationship.mock.calls.map(([input]) => input)).toEqual([
      { left: { datasetId: ids[0], column: "Region" }, right: { datasetId: ids[1], column: "Region" } },
      { left: { datasetId: ids[0], column: "Customer ID" }, right: { datasetId: ids[2], column: "Customer ID" } },
    ]);
  });

  it("removes imported objects in reverse order when setup fails", async () => {
    const deleted: string[] = [];
    const store: DemoWorkspaceStore = {
      listDatasets: async () => [],
      importFiles: async () => ({ datasets: [...importedDatasets] }),
      renameDataset: async () => { throw new Error("rename failed"); },
      saveDatasetRelationship: async () => { throw new Error("unexpected relationship"); },
      saveGroup: async () => { throw new Error("unexpected group"); },
      deleteDataset: async (datasetId) => {
        deleted.push(datasetId);
        return { status: "deleted", datasetId, removedGroupIds: [], updatedGroupIds: [] };
      },
    };

    await expect(createDemoWorkspace("retail-operations", "/demo", store)).rejects.toThrow("rename failed");
    expect(deleted).toEqual([...ids].reverse());
  });

  it("creates a relationship-free merge topic for the reviewed append flow", async () => {
    const renamed: DatasetSummary[] = [];
    const saveRelationship = vi.fn<DemoWorkspaceStore["saveDatasetRelationship"]>();
    const store: DemoWorkspaceStore = {
      listDatasets: async () => [],
      importFiles: async () => ({ datasets: [...importedDatasets] }),
      renameDataset: async ({ datasetId, displayName }) => {
        const value = { ...importedDatasets.find(({ id }) => id === datasetId)!, displayName };
        renamed.push(value);
        return value;
      },
      saveDatasetRelationship: saveRelationship,
      saveGroup: async (input) => ({
        id: "c".repeat(32), name: input.name, description: input.description,
        cadence: input.cadence, members: renamed, createdAt: importedAt, updatedAt: importedAt,
      }),
      deleteDataset: async (datasetId) => ({ status: "deleted", datasetId, removedGroupIds: [], updatedGroupIds: [] }),
    };

    const result = await createDemoWorkspace("merge-exports", "/demo", store);

    expect(result.datasets.map(({ displayName }) => displayName)).toEqual(["第 1 周订单", "第 2 周订单", "第 3 周订单"]);
    expect(result.group).toMatchObject({ name: "周期订单合并", cadence: "weekly" });
    expect(saveRelationship).not.toHaveBeenCalled();
  });
});
