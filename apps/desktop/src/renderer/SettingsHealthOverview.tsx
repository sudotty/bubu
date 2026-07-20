import { Bot, DatabaseBackup, KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { McpConnectionRegistryState, ProviderRegistryState } from "../shared/product-api.js";

type SettingsSection = "models" | "connectors" | "privacy";

export function SettingsHealthOverview({ onNavigate }: { readonly onNavigate: (section: SettingsSection) => void }) {
  const [providers, setProviders] = useState<ProviderRegistryState>();
  const [connections, setConnections] = useState<McpConnectionRegistryState>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void Promise.all([window.bubu.providers.list(), window.bubu.mcp.list()]).then(([providerState, connectionState]) => {
      if (!active) return;
      setProviders(providerState);
      setConnections(connectionState);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "读取本地配置状态失败");
    });
    return () => { active = false; };
  }, []);

  const encryptionAvailable = providers?.encryptionAvailable === true && connections?.encryptionAvailable === true;
  return <section className="settings-health" aria-label="设置健康总览">
    <header><div><p className="hero-kicker">LOCAL CONFIG HEALTH</p><h3>连接与恢复准备</h3></div><span className={encryptionAvailable ? "health-ready" : "health-warning"}><ShieldCheck size={14} />{encryptionAvailable ? "系统加密可用" : "系统加密不可用"}</span></header>
    {error && <p className="error-text">{error}</p>}
    <div>
      <button type="button" onClick={() => onNavigate("models")}><Bot size={18} /><span><strong>{providers?.providers.length ?? "—"} 个模型配置</strong><small>{providers?.activeProviderId ? "已有当前模型" : "需要选择当前模型"}</small></span></button>
      <button type="button" onClick={() => onNavigate("connectors")}><PlugZap size={18} /><span><strong>{connections?.connections.length ?? "—"} 个本地连接器</strong><small>每次读取或调用仍需单次批准</small></span></button>
      <button type="button" onClick={() => onNavigate("privacy")}><DatabaseBackup size={18} /><span><strong>备份与恢复</strong><small>创建加密存储之外的数据快照</small></span></button>
      <div><KeyRound size={18} /><span><strong>凭据只写</strong><small>{encryptionAvailable ? "密钥可安全保存且无法读回" : "当前只允许无密钥本地服务"}</small></span></div>
    </div>
  </section>;
}
