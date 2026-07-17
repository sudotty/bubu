import { useState } from "react";
import type { OperationId } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";

const numberFormat = new Intl.NumberFormat("zh-CN");

function errorMessage(error: unknown): string {
  return operationErrorMessage(error, "本地数据保护操作失败");
}

export function DataProtectionPanel({
  onRestored,
}: {
  readonly onRestored: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"backup" | "restore">();
  const [notice, setNotice] = useState<string>();
  const [operationId, setOperationId] = useState<OperationId>();

  async function cancelOperation(): Promise<void> {
    if (!operationId) return;
    const result = await window.bubu.operations.cancel(operationId);
    setNotice(result.cancelled ? "正在取消本地数据保护操作…" : "操作已经结束，无需取消");
  }

  async function createBackup(): Promise<void> {
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    setBusy("backup");
    setNotice(undefined);
    try {
      const result = await window.bubu.dataProtection.createBackup(nextOperationId);
      if (result.status === "created") {
        setNotice(`已创建 ${result.fileName} · ${numberFormat.format(result.datasetCount)} 个数据联系人 · 数据库 ${numberFormat.format(result.databaseBytes)} 字节。`);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(undefined);
      setOperationId((current) => current === nextOperationId ? undefined : current);
    }
  }

  async function restoreBackup(): Promise<void> {
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    setBusy("restore");
    setNotice(undefined);
    try {
      const result = await window.bubu.dataProtection.restoreBackup(nextOperationId);
      if (result.status === "restored") {
        await onRestored();
        setNotice(`已从 ${result.fileName} 恢复 ${numberFormat.format(result.datasetCount)} 个数据联系人和 ${numberFormat.format(result.groupCount)} 个群组。`);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(undefined);
      setOperationId((current) => current === nextOperationId ? undefined : current);
    }
  }

  return (
    <section className="data-protection-panel">
      <div>
        <p className="hero-kicker">LOCAL DATA PROTECTION</p>
        <h3>本地备份与恢复</h3>
        <p className="settings-copy">
          备份包含 SQLite 中的原始数据、版本、群组、校验规则、关系和对话，因此请像保护源表格一样保护它。模型密钥由操作系统加密存储，不进入备份。
        </p>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <div className="data-protection-actions">
        <button type="button" className="primary-action" onClick={() => void createBackup()} disabled={busy !== undefined}>
          {busy === "backup" ? "正在创建一致性备份…" : "创建本地数据备份"}
        </button>
        <button type="button" className="danger-action" onClick={() => void restoreBackup()} disabled={busy !== undefined}>
          {busy === "restore" ? "正在验证并恢复…" : "从备份恢复"}
        </button>
      </div>
      {operationId && (
        <button type="button" className="secondary-action" onClick={() => void cancelOperation()}>
          取消当前操作
        </button>
      )}
      <small>恢复前会验证格式、摘要、SQLite 完整性、迁移和隐私边界；验证失败不会替换当前数据。</small>
    </section>
  );
}
