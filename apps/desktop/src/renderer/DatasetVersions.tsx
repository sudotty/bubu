import { Clock3, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { DatasetSummary, DatasetVersionSummary } from "../shared/product-api.js";

export function DatasetVersions({ dataset, openRequest = 0 }: { readonly dataset: DatasetSummary; readonly openRequest?: number }) {
  const [versions, setVersions] = useState<readonly DatasetVersionSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setVersions([]);
    setError(undefined);
    setOpen(false);
  }, [dataset.id]);

  useEffect(() => {
    if (openRequest === 0) return;
    setOpen(true);
    if (versions.length === 0 && !loading) void load();
  }, [openRequest]);

  async function load(): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      setVersions(await window.bubu.datasets.versions(dataset.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "读取版本记录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="versions-menu" open={open} onToggle={(event) => {
      const nextOpen = event.currentTarget.open;
      setOpen(nextOpen);
      if (nextOpen && versions.length === 0 && !loading) void load();
    }}>
      <summary><Clock3 size={16} aria-hidden="true" /><span>版本 {dataset.version}</span></summary>
      <div className="versions-popover">
        <header><div><strong>数据版本</strong><small>替换会创建新版本，不会覆盖历史</small></div><button type="button" aria-label="刷新数据版本" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /></button></header>
        {loading && <p>正在读取版本…</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && versions.map((version) => (
          <article key={version.versionId} className={version.current ? "version-current" : undefined}>
            <span><strong>版本 {version.version}</strong><small>{version.sourceName}</small><small>{new Date(version.importedAt).toLocaleString("zh-CN")}</small></span>
            <span><small>{version.rowCount.toLocaleString("zh-CN")} 行 · {version.columnCount} 列</small>{version.current && <em>当前</em>}</span>
          </article>
        ))}
      </div>
    </details>
  );
}
