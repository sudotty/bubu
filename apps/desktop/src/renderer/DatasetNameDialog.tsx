import { Database, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DatasetSummary } from "../shared/product-api.js";

export function DatasetNameDialog({
  datasets,
  busy,
  onCancel,
  onSave,
}: {
  readonly datasets: readonly DatasetSummary[];
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSave: (names: ReadonlyMap<string, string>) => void;
}) {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    setNames(new Map(datasets.map((dataset) => [dataset.id, dataset.displayName])));
  }, [datasets]);

  const valid = datasets.every((dataset) => (names.get(dataset.id) ?? "").trim().length > 0);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="naming-dialog" role="dialog" aria-modal="true" aria-labelledby="naming-dialog-title">
        <header>
          <div><p className="eyebrow">本地数据对象</p><h3 id="naming-dialog-title">{datasets.length > 1 ? `为 ${datasets.length} 个数据对象命名` : "自定义数据对象名称"}</h3></div>
          <button type="button" className="icon-action" aria-label="关闭命名对话框" onClick={onCancel} disabled={busy}><X size={17} /></button>
        </header>
        <p>名称只用于 BuBu 本地工作区；原始文件名与不可变版本记录仍会保留，方便后续替换和审计。</p>
        <div className="naming-list">
          {datasets.map((dataset, index) => (
            <label key={dataset.id}>
              <span className="contact-avatar"><Database size={16} aria-hidden="true" /></span>
              <span><strong>{dataset.sourceName}</strong><small>数据对象 {index + 1} · {dataset.rowCount} 行 · {dataset.columnCount} 列</small></span>
              <input
                value={names.get(dataset.id) ?? ""}
                onChange={(event) => setNames((current) => new Map(current).set(dataset.id, event.target.value))}
                maxLength={100}
                autoFocus={index === 0}
                aria-label={`${dataset.sourceName} 的数据对象名称`}
              />
            </label>
          ))}
        </div>
        <footer>
          <button type="button" className="secondary-action" onClick={onCancel} disabled={busy}>稍后再改</button>
          <button type="button" className="primary-action" onClick={() => onSave(names)} disabled={busy || !valid}>{busy ? "正在保存…" : "保存名称并开始对话"}</button>
        </footer>
      </section>
    </div>
  );
}
