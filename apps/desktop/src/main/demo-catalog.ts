import { join } from "node:path";
import {
  parseDemoWorkspaceId,
  parseDemoWorkspaceImportResult,
  type DatasetDeletionResult,
  type DatasetGroup,
  type DatasetGroupSaveInput,
  type DatasetImportResult,
  type DatasetRelationship,
  type DatasetRelationshipSaveInput,
  type DatasetRenameInput,
  type DatasetSummary,
  type DemoWorkspaceId,
  type DemoWorkspaceImportResult,
} from "@bubu/contracts";

interface ResolvedDemoWorkspace {
  readonly id: DemoWorkspaceId;
  readonly name: string;
  readonly files: readonly string[];
}

const demoFiles: Readonly<Record<DemoWorkspaceId, readonly string[]>> = {
  "retail-operations": ["retail-orders.csv", "retail-targets.csv", "retail-customers.csv"],
  "reconciliation-cases": ["reconcile-sales.csv", "reconcile-refunds.csv", "reconcile-orders.csv", "reconcile-payments.csv"],
  "merge-exports": ["merge-week-1.csv", "merge-week-2.csv", "merge-week-3.csv"],
};

export interface DemoWorkspaceStore {
  listDatasets(): Promise<readonly DatasetSummary[]>;
  importFiles(sourcePaths: readonly string[], signal?: AbortSignal): Promise<DatasetImportResult>;
  renameDataset(input: DatasetRenameInput): Promise<DatasetSummary>;
  saveDatasetRelationship(input: DatasetRelationshipSaveInput): Promise<DatasetRelationship>;
  saveGroup(input: DatasetGroupSaveInput): Promise<DatasetGroup>;
  deleteDataset(datasetId: string): Promise<DatasetDeletionResult>;
}

export function resolveDemoWorkspace(value: unknown, demoDirectory: string): ResolvedDemoWorkspace {
  const id = parseDemoWorkspaceId(value);
  return {
    id,
    name: id === "retail-operations" ? "零售经营周报" : id === "reconciliation-cases" ? "销售退款与订单付款对账" : "周期订单合并",
    files: demoFiles[id].map((fileName) => join(demoDirectory, fileName)),
  };
}

export async function createDemoWorkspace(
  value: unknown,
  demoDirectory: string,
  store: DemoWorkspaceStore,
  signal?: AbortSignal,
): Promise<DemoWorkspaceImportResult> {
  const demo = resolveDemoWorkspace(value, demoDirectory);
  if ((await store.listDatasets()).length > 0) {
    throw new Error("示例工作区只能导入到空白本地工作区");
  }

  let imported: DatasetImportResult | undefined;
  try {
    imported = await store.importFiles(demo.files, signal);
    signal?.throwIfAborted();
    const displayNames = demo.id === "retail-operations"
      ? ["零售订单", "区域目标", "客户档案"] as const
      : demo.id === "reconciliation-cases"
        ? ["销售记录", "退款记录", "订单记录", "付款记录"] as const
        : ["第 1 周订单", "第 2 周订单", "第 3 周订单"] as const;
    const datasets = await Promise.all(imported.datasets.map((dataset, index) => store.renameDataset({
      datasetId: dataset.id,
      displayName: displayNames[index] ?? dataset.displayName,
    })));
    const [first, second, third, fourth] = datasets;
    if (!first || !second || !third || (demo.id === "reconciliation-cases" && !fourth)) throw new Error("示例工作区没有生成完整的数据对象");
    signal?.throwIfAborted();
    if (demo.id === "retail-operations") {
      await store.saveDatasetRelationship({ left: { datasetId: first.id, column: "Region" }, right: { datasetId: second.id, column: "Region" } });
      await store.saveDatasetRelationship({ left: { datasetId: first.id, column: "Customer ID" }, right: { datasetId: third.id, column: "Customer ID" } });
    } else if (demo.id === "reconciliation-cases") {
      await store.saveDatasetRelationship({ left: { datasetId: first.id, column: "Sale ID" }, right: { datasetId: second.id, column: "Sale ID" } });
    }
    signal?.throwIfAborted();
    const group = await store.saveGroup({
      name: demo.name,
      description: demo.id === "retail-operations" ? "订单、区域目标与客户分层的可关联经营示例" : demo.id === "reconciliation-cases" ? "销售与退款、订单与付款的本地确定性对账示例" : "三个同结构周期导出的受审本地合并示例",
      cadence: "weekly",
      datasetIds: datasets.map(({ id }) => id),
    });
    return parseDemoWorkspaceImportResult({ demoId: demo.id, datasets, group });
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const dataset of [...(imported?.datasets ?? [])].reverse()) {
      try {
        await store.deleteDataset(dataset.id);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], "示例工作区导入失败，且未能完整回滚");
    }
    throw error;
  }
}
