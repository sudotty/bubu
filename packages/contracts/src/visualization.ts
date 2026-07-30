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

export const visualizationCompositionSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(500),
  views: z.array(visualizationSpecSchema).min(1).max(4),
}).strict().superRefine((value, context) => {
  if (new Set(value.views.map(({ categoryLabel, valueLabel }) => `${categoryLabel}\u0000${valueLabel}`)).size !== value.views.length) {
    context.addIssue({ code: "custom", path: ["views"], message: "Visualization composition views must be unique" });
  }
});

export type VisualizationSpec = z.infer<typeof visualizationSpecSchema>;
export type VisualizationComposition = z.infer<typeof visualizationCompositionSchema>;
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

export type VisualizationCompositionRecommendation =
  | { readonly kind: "charts"; readonly reason: string; readonly composition: VisualizationComposition }
  | { readonly kind: "table"; readonly reason: string };

export function composeVisualizations(result: ResultLike, title: string): VisualizationCompositionRecommendation {
  if (result.rows.length === 0) return { kind: "table", reason: "没有结果行，图表不会增加信息。" };
  let valueIndexes = result.columns.map((column, index) => isNumeric(column.type) ? index : -1).filter((index) => index >= 0).slice(0, 4);
  if (valueIndexes.length === 0) return { kind: "table", reason: "结果中没有可安全绘制的数值列。" };
  let categoryIndex = result.columns.findIndex(({ type }, index) => !valueIndexes.includes(index) && !isNumeric(type));
  if (categoryIndex < 0) categoryIndex = result.columns.findIndex((_column, index) => !valueIndexes.includes(index));
  if (categoryIndex < 0 && valueIndexes.length > 1) {
    categoryIndex = valueIndexes[0] ?? -1;
    valueIndexes = valueIndexes.slice(1);
  }
  const category = result.columns[categoryIndex];
  if (!category) return { kind: "table", reason: "没有找到能与数值指标配对的维度列。" };
  if (result.rows.length > 20) return { kind: "table", reason: `共有 ${result.rows.length} 个结果行，完整表格比截断后的多图组合更可信。` };
  const labels = result.rows.map((row) => row[categoryIndex] === null ? "空值" : String(row[categoryIndex]));
  if (new Set(labels).size !== labels.length) return { kind: "table", reason: "维度值存在重复，多图组合会暗示未经计划批准的聚合。" };
  const chronological = category.type === "datetime" && labels.every((label) => Number.isFinite(Date.parse(label)));
  const order = result.rows.map((_row, index) => index).toSorted((left, right) => chronological ? Date.parse(labels[left] ?? "") - Date.parse(labels[right] ?? "") : left - right);
  const normalizedTitle = title.trim().slice(0, 500) || "查询结果";
  const views = valueIndexes.flatMap((valueIndex) => {
    const value = result.columns[valueIndex];
    if (!value) return [];
    const points = order.flatMap((rowIndex) => {
      const raw = result.rows[rowIndex]?.[valueIndex];
      const number = typeof raw === "number" ? raw : Number(raw);
      return raw !== null && Number.isFinite(number) ? [{ label: labels[rowIndex] ?? "空值", value: number }] : [];
    });
    if (points.length !== result.rows.length) return [];
    return [visualizationSpecSchema.parse({
      kind: chronological ? "line" : "bar",
      title: valueIndexes.length === 1 ? normalizedTitle : `${normalizedTitle} · ${value.label}`.slice(0, 500),
      categoryLabel: category.label,
      valueLabel: value.label,
      points,
      omittedPointCount: 0,
    })];
  });
  if (views.length === 0) return { kind: "table", reason: "数值指标含有不可绘制值，完整表格更可信。" };
  return {
    kind: "charts",
    reason: views.length === 1 ? "一个受审数值指标与唯一维度一一对应。" : `${views.length} 个受审数值指标共享同一唯一维度，可逐指标切换而不引入新的聚合。`,
    composition: visualizationCompositionSchema.parse({ schemaVersion: 1, title: normalizedTitle, views }),
  };
}

export function parseVisualizationSpec(value: unknown): VisualizationSpec {
  return visualizationSpecSchema.parse(value);
}

export function parseVisualizationComposition(value: unknown): VisualizationComposition {
  return visualizationCompositionSchema.parse(value);
}
