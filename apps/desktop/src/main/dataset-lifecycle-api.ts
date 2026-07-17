import { dialog, ipcMain } from "electron";
import { parseDatasetId, type DatasetSummary } from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface DatasetLifecycleApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

export function datasetExportFileName(dataset: DatasetSummary): string {
  const stem = dataset.displayName
    .normalize("NFKC")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);
  return `${stem || "dataset"}-v${dataset.version}.csv`;
}

function requireDataset(
  datasets: readonly DatasetSummary[],
  datasetID: string,
): DatasetSummary {
  const dataset = datasets.find(({ id }) => id === datasetID);
  if (!dataset) throw new Error("数据联系人不存在或已被删除");
  return dataset;
}

export function registerDatasetLifecycleApi({
  sidecars,
  assertTrustedSender,
}: DatasetLifecycleApiDependencies): void {
  ipcMain.handle(desktopChannels.exportDataset, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const datasetID = parseDatasetId(value);
    const dataset = requireDataset(await sidecars.listDatasets(), datasetID);
    const selection = await dialog.showSaveDialog({
      title: "导出当前数据版本",
      buttonLabel: "安全导出 CSV",
      defaultPath: datasetExportFileName(dataset),
      filters: [{ name: "Excel 安全 CSV", extensions: ["csv"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    if (selection.canceled || !selection.filePath) return { status: "cancelled" } as const;
    return sidecars.exportDataset(datasetID, selection.filePath);
  });

  ipcMain.handle(desktopChannels.deleteDataset, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const datasetID = parseDatasetId(value);
    const dataset = requireDataset(await sidecars.listDatasets(), datasetID);
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: "永久删除本地数据",
      message: `确定永久删除“${dataset.displayName}”吗？`,
      detail: "这会删除所有本地版本、预览、校验规则、关系和对话；成员不足的数据群组也会被删除。此操作无法撤销。",
      buttons: ["取消", "永久删除"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return { status: "cancelled" } as const;
    return sidecars.deleteDataset(datasetID);
  });
}
