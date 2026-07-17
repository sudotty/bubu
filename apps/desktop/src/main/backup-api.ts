import { dialog, ipcMain } from "electron";
import { desktopChannels } from "../shared/product-api.js";
import { parseOperationStart } from "@bubu/contracts";
import type { SidecarSupervisor } from "./sidecars.js";
import type { OperationRegistry } from "./operation-registry.js";

interface BackupApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly assertTrustedSender: (frameUrl: string) => void;
  readonly operations: OperationRegistry;
}

export function backupFileName(now: Date): string {
  return `bubu-data-${now.toISOString().slice(0, 10)}.bubu-backup`;
}

export function registerBackupApi({
  sidecars,
  assertTrustedSender,
  operations,
}: BackupApiDependencies): void {
  ipcMain.handle(desktopChannels.createBackup, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const { operationId } = parseOperationStart(value);
    const selection = await dialog.showSaveDialog({
      title: "备份本地 BuBu 数据",
      buttonLabel: "创建一致性备份",
      defaultPath: backupFileName(new Date()),
      filters: [{ name: "BuBu 本地数据备份", extensions: ["bubu-backup"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });
    const targetPath = selection.filePath;
    if (selection.canceled || !targetPath) return { status: "cancelled" } as const;
    return operations.run(operationId, (signal) => sidecars.createBackup(targetPath, signal));
  });

  ipcMain.handle(desktopChannels.restoreBackup, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const { operationId } = parseOperationStart(value);
    const selection = await dialog.showOpenDialog({
      title: "选择 BuBu 本地数据备份",
      buttonLabel: "检查备份",
      properties: ["openFile"],
      filters: [{ name: "BuBu 本地数据备份", extensions: ["bubu-backup"] }],
    });
    const sourcePath = selection.filePaths[0];
    if (selection.canceled || !sourcePath) return { status: "cancelled" } as const;
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: "恢复本地数据备份",
      message: "恢复会替换当前全部 BuBu 本地数据，是否继续？",
      detail: "BuBu 会先验证备份格式、SHA-256、SQLite 完整性、迁移版本和隐私约束；恢复成功前发生错误会保留当前数据库。模型密钥不在此备份中。",
      buttons: ["取消", "验证并恢复"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (confirmation.response !== 1) return { status: "cancelled" } as const;
    return operations.run(operationId, (signal) => sidecars.restoreBackup(sourcePath, signal));
  });
}
