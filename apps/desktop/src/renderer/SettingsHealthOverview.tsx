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
    setProviders(undefined);
    setConnections(undefined);
    const [providerResult, connectionResult] = await Promise.allSettled([window.bubu.providers.list(), window.bubu.mcp.list()]);
    if (providerResult.status === "fulfilled") setProviders(providerResult.value);
    if (connectionResult.status === "fulfilled") setConnections(connectionResult.value);
    const failures = [providerResult, connectionResult].filter((result) => result.status === "rejected");
    if (failures.length > 0) setError(`${failures.length} 项本地诊断未返回。未知状态不会被当成缺失配置。`);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const diagnosticsReady = providers !== undefined && connections !== undefined;
  const encryptionAvailable = diagnosticsReady ? providers.encryptionAvailable && connections.encryptionAvailable : null;
  const findings = deriveSettingsHealth({ encryptionAvailable, providerCount: providers?.providers.length ?? null, hasActiveProvider: providers ? providers.activeProviderId !== null : null, connectorCount: connections?.connections.length ?? null });
  const navigateToFinding = (section: SettingsHealthSection | undefined) => { if (section) onNavigate(section); };
  return <section className="settings-health" aria-label="设置健康总览">
    <header><div><p className="chat-context-label">配置健康</p><h3>使用前检查</h3></div><button type="button" className="settings-health-refresh" onClick={() => void load()} disabled={loading} aria-busy={loading}><RefreshCw size={14} />{loading ? "检查中" : "重新检查"}</button></header>
    {error && <p className="error-text">{error}</p>}
    {!loading && <ol className="settings-findings">{findings.map((finding) => <li className={`settings-finding settings-finding-${finding.severity}`} key={finding.id}><span>{finding.id === "provider" || finding.id === "active-provider" ? <Bot size={17} /> : finding.id === "connectors" ? <PlugZap size={17} /> : finding.id === "encryption" ? <KeyRound size={17} /> : <ShieldCheck size={17} />}</span><div><strong>{finding.title}</strong><small>{finding.detail}</small></div>{finding.section && <button type="button" onClick={() => navigateToFinding(finding.section)}>{finding.severity === "optional" ? "查看" : "去处理"}</button>}</li>)}</ol>}
  </section>;
}
