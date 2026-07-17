import { useEffect, useMemo, useState } from "react";
import type { ColumnDistribution } from "../shared/product-api.js";

type DistributionState =
  | { readonly kind: "loading" }
  | { readonly kind: "loaded"; readonly value: ColumnDistribution }
  | { readonly kind: "failed"; readonly message: string };

const numberFormat = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 });

export function ColumnDistributionPanel({
  datasetId,
  versionId,
  columns,
}: {
  readonly datasetId: string;
  readonly versionId: string;
  readonly columns: readonly { readonly name: string; readonly inferredType: string }[];
}) {
  const [column, setColumn] = useState(columns[0]?.name ?? "");
  const [state, setState] = useState<DistributionState>({ kind: "loading" });

  useEffect(() => {
    if (!columns.some(({ name }) => name === column)) setColumn(columns[0]?.name ?? "");
  }, [column, columns, versionId]);

  useEffect(() => {
    if (!column) return;
    let active = true;
    setState({ kind: "loading" });
    void window.bubu.datasets.distribution({ datasetId, column })
      .then((value) => {
        if (active) setState({ kind: "loaded", value });
      })
      .catch((error: unknown) => {
        if (active) setState({
          kind: "failed",
          message: error instanceof Error ? error.message : "读取本地列分布失败",
        });
      });
    return () => { active = false; };
  }, [column, datasetId, versionId]);

  const maximumCount = useMemo(() => {
    if (state.kind !== "loaded") return 0;
    if (state.value.kind === "numeric") {
      return Math.max(0, ...state.value.bins.map(({ count }) => count));
    }
    if (state.value.kind === "categorical") {
      return Math.max(0, ...state.value.values.map(({ count }) => count));
    }
    return 0;
  }, [state]);

  return (
    <section className="distribution-panel" aria-label="仅本地列分布探查">
      <header className="distribution-header">
        <div><h4>列分布探查</h4><small>仅在本地计算和显示，真实高频值不会进入模型上下文。</small></div>
        <select value={column} onChange={(event) => setColumn(event.target.value)}>
          {columns.map(({ name, inferredType }) => <option key={name} value={name}>{name} · {inferredType}</option>)}
        </select>
      </header>
      {state.kind === "loading" && <p className="empty-copy">正在扫描当前本地版本…</p>}
      {state.kind === "failed" && <p className="error-text">{state.message}</p>}
      {state.kind === "loaded" && state.value.kind === "empty" && <p className="empty-copy">这一列没有非空值。</p>}
      {state.kind === "loaded" && state.value.kind === "numeric" && (
        <div>
          <p className="distribution-summary">
            {numberFormat.format(state.value.nonNullCount)} 个非空值 · 均值 {numberFormat.format(state.value.mean)} · 范围 {numberFormat.format(state.value.minimum)}–{numberFormat.format(state.value.maximum)}
          </p>
          <div className="distribution-bars">
            {state.value.bins.map((bin, index) => (
              <div className="distribution-row" key={`${bin.minimum}-${index}`}>
                <span>{numberFormat.format(bin.minimum)}–{numberFormat.format(bin.maximum)}</span>
                <i style={{ width: `${maximumCount === 0 ? 0 : (bin.count / maximumCount) * 100}%` }} />
                <strong>{numberFormat.format(bin.count)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      {state.kind === "loaded" && state.value.kind === "categorical" && (
        <div>
          <p className="distribution-summary">{numberFormat.format(state.value.nonNullCount)} 个非空值 · 高频值最多显示 10 项</p>
          <div className="distribution-bars">
            {state.value.values.map((item, index) => (
              <div className="distribution-row" key={`${item.preview}-${index}`}>
                <span title={item.preview}>{item.preview}{item.truncated ? "…" : ""}</span>
                <i style={{ width: `${maximumCount === 0 ? 0 : (item.count / maximumCount) * 100}%` }} />
                <strong>{numberFormat.format(item.count)} · {(item.rate * 100).toFixed(1)}%</strong>
              </div>
            ))}
          </div>
          {state.value.otherCount > 0 && <small>其余值：{numberFormat.format(state.value.otherCount)} 行</small>}
        </div>
      )}
    </section>
  );
}
