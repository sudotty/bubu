import { Bot, KeyRound, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { McpConnectionRegistryState, ProviderRegistryState } from "../shared/product-api.js";
import { deriveSettingsHealth, type SettingsHealthSection } from "./settings-health.js";

export function SettingsHealthOverview({ onNavigate }: { readonly onNavigate: (section: SettingsHealthSection) => void }) {
  const [providers, setProviders] = useState<ProviderRegistryState>();
  const [connections, setConnections] = useState<McpConnectionRegistryState>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function load(): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const [providerState, connectionState] = await Promise.all([window.bubu.providers.list(), window.bubu.mcp.list()]);
      setProviders(providerState);
      setConnections(connectionState);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取本地配置状态失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const encryptionAvailable = providers?.encryptionAvailable === true && connections?.encryptionAvailable === true;
  const findings = deriveSettingsHealth({ encryptionAvailable, providerCount: providers?.providers.length ?? 0, hasActiveProvider: providers?.activeProviderId !== null && providers?.activeProviderId !== undefined, connectorCount: connections?.connections.length ?? 0 });
  const navigateToFinding = (section: SettingsHealthSection | undefined) => { if (section) onNavigate(section); };
  return <section className="settings-health" aria-label="设置健康总览">
    <header><div><p className="chat-context-label">本地配置健康</p><h3>先处理影响使用的问题</h3></div><button type="button" className="settings-health-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={14} />{loading ? "检查中" : "重新检查"}</button></header>
    {error && <p className="error-text">{error}</p>}
    {!loading && <ol className="settings-findings">{findings.map((finding) => <li className={`settings-finding settings-finding-${finding.severity}`} key={finding.id}><span>{finding.id === "provider" || finding.id === "active-provider" ? <Bot size={17} /> : finding.id === "connectors" ? <PlugZap size={17} /> : finding.id === "encryption" ? <KeyRound size={17} /> : <ShieldCheck size={17} />}</span><div><strong>{finding.title}</strong><small>{finding.detail}</small></div>{finding.section && <button type="button" onClick={() => navigateToFinding(finding.section)}>{finding.severity === "optional" ? "查看" : "去处理"}</button>}</li>)}</ol>}
    <div className="settings-health-metrics"><span><strong>{providers?.providers.length ?? "—"}</strong>模型配置</span><span><strong>{connections?.connections.length ?? "—"}</strong>本地连接器</span><span><strong>{encryptionAvailable ? "可用" : "不可用"}</strong>系统加密</span></div>
  </section>;
}
