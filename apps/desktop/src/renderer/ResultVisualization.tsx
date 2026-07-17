import { useMemo } from "react";
import {
  deriveVisualizationSpec,
  type VisualizationSpec,
} from "@bubu/contracts";

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
  const spec = useMemo(() => deriveVisualizationSpec(result, title), [result, title]);
  if (!spec) return null;
  const chart = coordinates(spec);
  const barWidth = Math.max(6, Math.min(42, (chart.plotWidth / spec.points.length) * 0.66));
  const linePoints = spec.points.map(({ value }, index) => `${chart.x(index)},${chart.y(value)}`).join(" ");

  return (
    <figure className="result-visualization">
      <figcaption>
        <div><p className="hero-kicker">LOCAL VISUALIZATION</p><h4>{spec.title}</h4></div>
        <span>{spec.kind === "line" ? "趋势图" : "柱状图"} · {spec.valueLabel}</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${spec.title}，${spec.categoryLabel} 对 ${spec.valueLabel}`}>
        <line x1={plot.left} x2={width - plot.right} y1={chart.zeroY} y2={chart.zeroY} className="chart-axis" />
        {spec.kind === "bar" && spec.points.map((point, index) => {
          const valueY = chart.y(point.value);
          const y = Math.min(valueY, chart.zeroY);
          return <rect key={`${point.label}-${index}`} x={chart.x(index) - barWidth / 2} y={y} width={barWidth} height={Math.max(1, Math.abs(chart.zeroY - valueY))} rx={4} className="chart-bar"><title>{point.label}: {point.value}</title></rect>;
        })}
        {spec.kind === "line" && <>
          <polyline points={linePoints} className="chart-line" />
          {spec.points.map((point, index) => <circle key={`${point.label}-${index}`} cx={chart.x(index)} cy={chart.y(point.value)} r={4} className="chart-point"><title>{point.label}: {point.value}</title></circle>)}
        </>}
        {spec.points.map((point, index) => <text key={`label-${point.label}-${index}`} x={chart.x(index)} y={height - 26} textAnchor="middle" className="chart-label">{shortLabel(point.label)}</text>)}
        <text x={plot.left} y={14} className="chart-value-label">{chart.maximum.toLocaleString("zh-CN")}</text>
        <text x={plot.left} y={height - plot.bottom + 16} className="chart-value-label">{chart.minimum.toLocaleString("zh-CN")}</text>
      </svg>
      {spec.omittedPointCount > 0 && <small>为保证可读性，图中省略了其余 {spec.omittedPointCount} 个点；表格仍保留完整的本地结果。</small>}
    </figure>
  );
}
