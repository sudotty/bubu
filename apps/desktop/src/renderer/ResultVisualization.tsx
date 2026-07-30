import { useEffect, useId, useMemo, useState } from "react";
import {
  composeVisualizations,
  type VisualizationSpec,
} from "@bubu/contracts";
import { preferredVisualizationMetric, savePreferredVisualizationMetric, visualizationSchemaSignature } from "./visualization-preferences.js";

interface ResultVisualizationProps {
  readonly title: string;
  readonly result: {
    readonly columns: readonly { readonly label: string; readonly type: "null" | "boolean" | "integer" | "real" | "datetime" | "text" }[];
    readonly rows: readonly (readonly (string | number | boolean | null)[])[];
  };
}

const width = 680;
const height = 280;
const plot = { left: 54, right: 18, top: 22, bottom: 54 } as const;

function coordinates(spec: VisualizationSpec) {
  const values = spec.points.map(({ value }) => value);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const range = maximum - minimum || 1;
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const y = (value: number) => plot.top + ((maximum - value) / range) * plotHeight;
  const x = (index: number) => plot.left + ((index + 0.5) / spec.points.length) * plotWidth;
  return { minimum, maximum, plotWidth, plotHeight, y, x, zeroY: y(0) };
}

function shortLabel(value: string): string {
  return value.length > 10 ? `${value.slice(0, 9)}…` : value;
}

export function ResultVisualization({ result, title }: ResultVisualizationProps) {
  const dataTableId = useId();
  const [selectedView, setSelectedView] = useState(0);
  const recommendation = useMemo(() => composeVisualizations(result, title), [result, title]);
  const schemaSignature = useMemo(() => visualizationSchemaSignature(result.columns), [result.columns]);
  useEffect(() => {
    if (recommendation.kind !== "charts") return setSelectedView(0);
    const preferred = preferredVisualizationMetric(localStorage, schemaSignature);
    const index = recommendation.composition.views.findIndex(({ valueLabel }) => valueLabel === preferred);
    setSelectedView(index >= 0 ? index : 0);
  }, [recommendation, schemaSignature]);
  if (recommendation.kind === "table") return <section className="visualization-guidance"><strong>建议保留表格</strong><p>{recommendation.reason}</p></section>;
  const spec = recommendation.composition.views[selectedView] ?? recommendation.composition.views[0];
  if (!spec) return <section className="visualization-guidance"><strong>建议保留表格</strong><p>没有可安全绘制的指标。</p></section>;
  const chart = coordinates(spec);
  const barWidth = Math.max(6, Math.min(42, (chart.plotWidth / spec.points.length) * 0.66));
  const linePoints = spec.points.map(({ value }, index) => `${chart.x(index)},${chart.y(value)}`).join(" ");
  const yTicks = [chart.maximum, (chart.maximum + chart.minimum) / 2, chart.minimum].filter((value, index, values) => values.findIndex((candidate) => Math.abs(candidate - value) < Number.EPSILON) === index);

  return (
    <figure className="result-visualization">
      <figcaption>
        <div><p className="hero-kicker">本地可视化</p><h4>{spec.title}</h4></div>
        <span>{spec.kind === "line" ? "趋势图" : "柱状图"} · {spec.valueLabel}</span>
      </figcaption>
      {recommendation.composition.views.length > 1 && <div className="visualization-switcher" role="tablist" aria-label="切换受审数值指标">{recommendation.composition.views.map((view, index) => <button type="button" role="tab" aria-selected={selectedView === index} tabIndex={selectedView === index ? 0 : -1} className={selectedView === index ? "is-selected" : ""} key={view.valueLabel} onClick={() => { setSelectedView(index); savePreferredVisualizationMetric(localStorage, schemaSignature, view.valueLabel); }}>{view.valueLabel}</button>)}</div>}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${spec.title}，${spec.categoryLabel} 对 ${spec.valueLabel}`} aria-describedby={dataTableId}>
        {yTicks.map((value) => <g key={value} aria-hidden="true"><line x1={plot.left} x2={width - plot.right} y1={chart.y(value)} y2={chart.y(value)} className="chart-grid" /><text x={plot.left - 8} y={chart.y(value) + 4} textAnchor="end" className="chart-value-label">{value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</text></g>)}
        <line x1={plot.left} x2={width - plot.right} y1={chart.zeroY} y2={chart.zeroY} className="chart-axis" />
        {spec.kind === "bar" && spec.points.map((point, index) => {
          const valueY = chart.y(point.value);
          const y = Math.min(valueY, chart.zeroY);
          return <rect key={`${point.label}-${index}`} x={chart.x(index) - barWidth / 2} y={y} width={barWidth} height={Math.max(1, Math.abs(chart.zeroY - valueY))} rx={4} className="chart-bar" tabIndex={0} role="img" aria-label={`${point.label}：${point.value}`}><title>{point.label}: {point.value}</title></rect>;
        })}
        {spec.kind === "line" && <>
          <polyline points={linePoints} className="chart-line" />
          {spec.points.map((point, index) => <circle key={`${point.label}-${index}`} cx={chart.x(index)} cy={chart.y(point.value)} r={4} className="chart-point" tabIndex={0} role="img" aria-label={`${point.label}：${point.value}`}><title>{point.label}: {point.value}</title></circle>)}
        </>}
        {spec.points.length <= 12 && spec.points.map((point, index) => <text key={`value-${point.label}-${index}`} x={chart.x(index)} y={Math.max(12, chart.y(point.value) - 8)} textAnchor="middle" className="chart-point-value" aria-hidden="true">{point.value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</text>)}
        {spec.points.map((point, index) => <text key={`label-${point.label}-${index}`} x={chart.x(index)} y={height - 26} textAnchor="middle" className="chart-label">{shortLabel(point.label)}</text>)}
      </svg>
      <p className="visualization-reason">{recommendation.reason}</p>
      <details id={dataTableId} className="chart-data-alternative"><summary>查看图表数据表</summary><div className="table-scroll"><table><thead><tr><th scope="col">{spec.categoryLabel}</th><th scope="col">{spec.valueLabel}</th></tr></thead><tbody>{spec.points.map((point, index) => <tr key={`${point.label}-${index}`}><td>{point.label}</td><td>{point.value}</td></tr>)}</tbody></table></div></details>
      {spec.omittedPointCount > 0 && <small>为保证可读性，图中省略了其余 {spec.omittedPointCount} 个点；表格仍保留完整的本地结果。</small>}
    </figure>
  );
}
