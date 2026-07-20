import { z } from "zod";
import { columnTypeSchema } from "./dataset.js";

const visualizationPointSchema = z.object({
  label: z.string().max(500),
  value: z.number().finite(),
}).strict();

export const visualizationSpecSchema = z.object({
  kind: z.enum(["bar", "line"]),
  title: z.string().trim().min(1).max(500),
  categoryLabel: z.string().min(1).max(500),
  valueLabel: z.string().min(1).max(500),
  points: z.array(visualizationPointSchema).min(1).max(20),
  omittedPointCount: z.number().int().nonnegative(),
}).strict();

export type VisualizationSpec = z.infer<typeof visualizationSpecSchema>;
export type VisualizationRecommendation =
  | { readonly kind: "chart"; readonly reason: string; readonly spec: VisualizationSpec }
  | { readonly kind: "table"; readonly reason: string };

interface ResultColumnLike {
  readonly label: string;
  readonly type: z.infer<typeof columnTypeSchema>;
}

interface ResultLike {
  readonly columns: readonly ResultColumnLike[];
  readonly rows: readonly (readonly (string | number | boolean | null)[])[];
}

function isNumeric(type: ResultColumnLike["type"]): boolean {
  return type === "integer" || type === "real";
}

export function recommendVisualization(result: ResultLike, title: string): VisualizationRecommendation {
  if (result.rows.length === 0) return { kind: "table", reason: "没有结果行，图表不会增加信息。" };
  if (result.columns.length < 2) return { kind: "table", reason: "至少需要一个分类列和一个数值列才能形成可解释图表。" };
  let valueIndex = -1;
  for (const [index, column] of result.columns.entries()) {
    if (isNumeric(column.type)) valueIndex = index;
  }
  if (valueIndex < 0) return { kind: "table", reason: "结果中没有可安全绘制的数值列。" };
  let categoryIndex = result.columns.findIndex(({ type }, index) => index !== valueIndex && !isNumeric(type));
  if (categoryIndex < 0) categoryIndex = result.columns.findIndex((_column, index) => index !== valueIndex);
  const category = result.columns[categoryIndex];
  const value = result.columns[valueIndex];
  if (!category || !value) return { kind: "table", reason: "没有找到与数值列配对的分类列。" };

  const points = result.rows
    .map((row) => {
      const rawValue = row[valueIndex];
      const number = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (rawValue === null || !Number.isFinite(number)) return undefined;
      const rawLabel = row[categoryIndex];
      return { label: rawLabel === null ? "空值" : String(rawLabel), value: number };
    })
    .filter((point): point is { readonly label: string; readonly value: number } => point !== undefined);
  if (points.length === 0) return { kind: "table", reason: "数值列没有可绘制的有限值。" };
  const labels = new Set(points.map(({ label }) => label));
  if (labels.size !== points.length) return { kind: "table", reason: "分类值存在重复，直接画图会暗示未经计划批准的聚合。" };
  if (points.length > 20) return { kind: "table", reason: `共有 ${points.length} 个分类，表格比截断图表更完整。` };
  const chronological = category.type === "datetime" && points.every(({ label }) => Number.isFinite(Date.parse(label)));
  const visiblePoints = chronological ? points.toSorted((left, right) => Date.parse(left.label) - Date.parse(right.label)) : points;
  const spec = visualizationSpecSchema.parse({
    kind: chronological ? "line" : "bar",
    title: title.trim().slice(0, 500) || "查询结果",
    categoryLabel: category.label,
    valueLabel: value.label,
    points: visiblePoints,
    omittedPointCount: 0,
  });
  return { kind: "chart", reason: chronological ? "时间分类完整可解析，使用按时间排序的趋势图。" : "唯一分类与有限数值一一对应，使用柱状图便于比较。", spec };
}

export function deriveVisualizationSpec(result: ResultLike, title: string): VisualizationSpec | undefined {
  const recommendation = recommendVisualization(result, title);
  return recommendation.kind === "chart" ? recommendation.spec : undefined;
}

export function parseVisualizationSpec(value: unknown): VisualizationSpec {
  return visualizationSpecSchema.parse(value);
}
