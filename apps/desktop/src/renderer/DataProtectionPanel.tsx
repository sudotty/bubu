import { useEffect, useState } from "react";
import type { ConversationRetentionPolicy, OperationId, PrivacyPolicy } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { readPromptTemplateRegistry, writePromptTemplateRegistry } from "./prompt-template-preferences.js";
import { readVisualizationPreferences, writeVisualizationPreferences } from "./visualization-preferences.js";
import { resetOnboarding } from "./onboarding-preferences.js";

const numberFormat = new Intl.NumberFormat("zh-CN");

function byteLabel(bytes: number): string {
  if (bytes < 1_024) return `${bytes} 字节`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

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
  const [privacyPolicy, setPrivacyPolicy] = useState<PrivacyPolicy>();
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [retentionPolicy, setRetentionPolicy] = useState<ConversationRetentionPolicy>();
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [configurationBusy, setConfigurationBusy] = useState<"backup" | "restore">();

  useEffect(() => {
    let active = true;
    void window.bubu.privacyPolicy.get()
      .then((value) => { if (active) setPrivacyPolicy(value); })
      .catch((error) => { if (active) setNotice(errorMessage(error)); });
    void window.bubu.conversations.retentionPolicy()
      .then((value) => { if (active) setRetentionPolicy(value); })
      .catch((error) => { if (active) setNotice(errorMessage(error)); });
    return () => { active = false; };
  }, []);

  async function setStrictPrivateMode(enabled: boolean): Promise<void> {
    setPrivacyBusy(true);
    setNotice(undefined);
    try {
      const value = await window.bubu.privacyPolicy.save({ schemaVersion: 1, mode: enabled ? "strict-private" : "local-private", localDlpEnabled: true });
      setPrivacyPolicy(value);
      setNotice(enabled
        ? "严格隐私模式已启用：远程模型只接收结构，问题文本继续经过本地敏感内容阻断。"
        : "已切换为本地私密模式：远程模型可接收结构与不可逆合成示例，原始行仍不会自动出站。");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setPrivacyBusy(false);
    }
  }

  async function saveRetentionPolicy(): Promise<void> {
    if (!retentionPolicy) return;
    setRetentionBusy(true);
    setNotice(undefined);
    try {
      const policy = await window.bubu.conversations.saveRetentionPolicy(retentionPolicy);
      setRetentionPolicy(policy);
      setNotice(policy.enabled
        ? `自动保留已启用：仅永久清理归档超过 ${policy.retentionDays} 天且没有工作流引用的任务。`
        : "自动保留已关闭；归档任务只会在你逐项确认后永久删除。");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setRetentionBusy(false);
    }
  }

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
        setNotice(`已创建 ${result.fileName} · ${numberFormat.format(result.datasetCount)} 个数据对象 · 数据库 ${byteLabel(result.databaseBytes)}。`);
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
        setNotice(`已从 ${result.fileName} 恢复 ${numberFormat.format(result.datasetCount)} 个数据对象和 ${numberFormat.format(result.groupCount)} 个业务主题。`);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(undefined);
      setOperationId((current) => current === nextOperationId ? undefined : current);
    }
  }

  async function createConfigurationBackup(): Promise<void> {
    setConfigurationBusy("backup");
    setNotice(undefined);
    try {
      const result = await window.bubu.dataProtection.createConfigurationBackup({
        promptTemplates: readPromptTemplateRegistry(),
        visualizationPreferences: [...readVisualizationPreferences(window.localStorage)],
      });
      if (result.status === "created") setNotice(`已导出 ${result.fileName}。凭据、数据和外部连接没有进入设置文件。`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setConfigurationBusy(undefined);
    }
  }

  async function restoreConfigurationBackup(): Promise<void> {
    setConfigurationBusy("restore");
    setNotice(undefined);
    try {
      const result = await window.bubu.dataProtection.restoreConfigurationBackup();
      if (result.status === "restored") {
        const previousPromptTemplates = readPromptTemplateRegistry();
        const previousVisualizationPreferences = [...readVisualizationPreferences(window.localStorage)];
        try {
          writePromptTemplateRegistry(result.rendererPreferences.promptTemplates);
          writeVisualizationPreferences(window.localStorage, result.rendererPreferences.visualizationPreferences);
          const [nextPrivacyPolicy, nextRetentionPolicy] = await Promise.all([
            window.bubu.privacyPolicy.get(),
            window.bubu.conversations.retentionPolicy(),
          ]);
          await window.bubu.dataProtection.finalizeConfigurationRestore({ rollbackToken: result.rollbackToken, commit: true });
          setPrivacyPolicy(nextPrivacyPolicy);
          setRetentionPolicy(nextRetentionPolicy);
        } catch (error) {
          try {
            writePromptTemplateRegistry(previousPromptTemplates);
            writeVisualizationPreferences(window.localStorage, previousVisualizationPreferences);
          } finally {
            await window.bubu.dataProtection.finalizeConfigurationRestore({ rollbackToken: result.rollbackToken, commit: false });
          }
          throw error;
        }
        setNotice(`已从 ${result.fileName} 恢复设置。模型、MCP、Hub 与 Webhook 连接未包含在文件中，需要在这台设备重新创建并授权。`);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setConfigurationBusy(undefined);
    }
  }

  return (
    <section className="data-protection-panel">
      <section className="encryption-guidance" aria-labelledby="encryption-guidance-title">
        <div><p className="hero-kicker">系统凭据存储</p><h3 id="encryption-guidance-title">模型密钥加密</h3></div>
        <p>BuBu 使用 macOS 钥匙串或 Windows 凭据管理器保存模型密钥，不会降级为明文文件。若健康检查显示不可用，请先解锁或重新登录当前系统账户；受管设备请确认凭据存储策略允许桌面应用访问，然后回到健康检查重新检测。</p>
        <small>系统加密不可用时，无密钥的本地模型仍可使用；BuBu 会拒绝保存需要密钥的配置。</small>
      </section>
      <section className="strict-privacy-settings" aria-labelledby="strict-privacy-title">
        <div><p className="hero-kicker">模型出站策略</p><h3 id="strict-privacy-title">严格隐私模式</h3></div>
        <p>本地 DLP 始终在所有模型问题和 Agent 目标发送前阻止访问密钥、身份证件、邮箱、电话和疑似粘贴表格；检查结果只返回风险类别，不返回匹配内容。</p>
        <label className="strict-privacy-toggle">
          <input
            type="checkbox"
            checked={privacyPolicy?.mode === "strict-private"}
            disabled={!privacyPolicy || privacyBusy}
            onChange={(event) => void setStrictPrivateMode(event.currentTarget.checked)}
          />
          <span><strong>远程模型仅使用 Schema</strong><small>本地 Ollama 等回环模型仍可使用不可逆合成示例；聚合披露继续单独审查。</small></span>
        </label>
        <small>{privacyPolicy ? `当前模式：${privacyPolicy.mode === "strict-private" ? "严格隐私" : "本地私密"} · 本地 DLP 不可关闭` : "正在读取本地隐私策略…"}</small>
      </section>
      <section className="conversation-retention-settings" aria-labelledby="conversation-retention-title">
        <div><p className="hero-kicker">本地数据生命周期</p><h3 id="conversation-retention-title">归档任务保留</h3></div>
        <p>默认不自动删除。启用后，只清理已归档、超过保留期且没有任何工作流证据引用的任务；活动任务和受引用证据始终保留。</p>
        <label className="strict-privacy-toggle"><input type="checkbox" checked={retentionPolicy?.enabled ?? false} disabled={!retentionPolicy || retentionBusy} onChange={(event) => setRetentionPolicy((current) => current ? { ...current, enabled: event.currentTarget.checked } : current)} /><span><strong>自动清理符合条件的归档任务</strong><small>后台每六小时检查一次，并分批持续处理到当前积压清空；关闭后仍可逐项永久删除。</small></span></label>
        <label><span>保留天数</span><input type="number" min={30} max={3650} step={1} value={retentionPolicy?.retentionDays ?? 90} disabled={!retentionPolicy || retentionBusy} onChange={(event) => setRetentionPolicy((current) => current ? { ...current, retentionDays: Number(event.currentTarget.value) } : current)} /></label>
        <button type="button" className="secondary-action" disabled={!retentionPolicy || retentionBusy || retentionPolicy.retentionDays < 30 || retentionPolicy.retentionDays > 3650} onClick={() => void saveRetentionPolicy()}>{retentionBusy ? "正在保存…" : "保存保留策略"}</button>
      </section>
      <section className="configuration-backup-settings" aria-labelledby="configuration-backup-title">
        <div><p className="hero-kicker">跨设备迁移</p><h3 id="configuration-backup-title">产品设置备份</h3></div>
        <p>导出隐私与保留策略、Agent 定义、提示模板和图表偏好。文件不包含数据、模型密钥、MCP 凭据、Hub 令牌或 Webhook 密钥。</p>
        <p className="settings-copy"><strong>设置文件本身不加密。</strong>它可能包含 Agent 目标和自定义提示词，请只保存到受信任的位置并按内部配置文件保护。</p>
        <div className="data-protection-actions">
          <button type="button" className="secondary-action" disabled={configurationBusy !== undefined} onClick={() => void createConfigurationBackup()}>{configurationBusy === "backup" ? "正在导出…" : "导出产品设置"}</button>
          <button type="button" className="secondary-action" disabled={configurationBusy !== undefined} onClick={() => void restoreConfigurationBackup()}>{configurationBusy === "restore" ? "正在恢复…" : "恢复产品设置"}</button>
        </div>
        <small>恢复前会完整验证格式并在失败时回滚已写入的本地设置；外部连接需要重新创建并授权。</small>
      </section>
      <section className="configuration-backup-settings" aria-labelledby="onboarding-reset-title">
        <div><p className="hero-kicker">使用引导</p><h3 id="onboarding-reset-title">重新显示起步建议</h3></div>
        <p>如果之前暂时隐藏了数据首页的结构化建议，可以随时重新开启；不会重置任何数据或设置。</p>
        <button type="button" className="secondary-action" onClick={() => { resetOnboarding(window.localStorage, window); setNotice("起步建议已重新开启；返回数据首页即可查看。"); }}>重新显示起步建议</button>
      </section>
      <div>
        <p className="hero-kicker">本地数据保护</p>
        <h3>本地备份与恢复</h3>
        <p className="settings-copy">
          备份包含 SQLite 中的原始数据、版本、业务主题、校验规则、关系和对话，因此请像保护源表格一样保护它。模型密钥由操作系统加密存储，不进入备份。
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
      <div className="recovery-guidance"><strong>恢复会发生什么？</strong><ol><li>选择本地 `.bubu-backup` 文件。</li><li>先验证摘要、结构和隐私约束，当前数据保持不变。</li><li>验证通过后原子替换本地目录，并重新加载数据对象。</li></ol><p>恢复不会导入模型或 MCP 密钥；请在新设备上重新配置凭据。</p></div>
    </section>
  );
}
