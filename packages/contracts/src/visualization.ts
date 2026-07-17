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

export function deriveVisualizationSpec(result: ResultLike, title: string): VisualizationSpec | undefined {
  if (result.rows.length === 0 || result.columns.length < 2) return undefined;
  let valueIndex = -1;
  for (const [index, column] of result.columns.entries()) {
    if (isNumeric(column.type)) valueIndex = index;
  }
  if (valueIndex < 0) return undefined;
  let categoryIndex = result.columns.findIndex(({ type }, index) => index !== valueIndex && !isNumeric(type));
  if (categoryIndex < 0) categoryIndex = result.columns.findIndex((_column, index) => index !== valueIndex);
  const category = result.columns[categoryIndex];
  const value = result.columns[valueIndex];
  if (!category || !value) return undefined;

  const points = result.rows
    .map((row) => {
      const rawValue = row[valueIndex];
      const number = typeof rawValue === "number" ? rawValue : Number(rawValue);
      if (rawValue === null || !Number.isFinite(number)) return undefined;
      const rawLabel = row[categoryIndex];
      return { label: rawLabel === null ? "空值" : String(rawLabel), value: number };
    })
    .filter((point): point is { readonly label: string; readonly value: number } => point !== undefined);
  const visiblePoints = points.slice(0, 20);
  if (visiblePoints.length === 0) return undefined;
  return visualizationSpecSchema.parse({
    kind: category.type === "datetime" ? "line" : "bar",
    title: title.trim().slice(0, 500) || "查询结果",
    categoryLabel: category.label,
    valueLabel: value.label,
    points: visiblePoints,
    omittedPointCount: Math.max(0, points.length - visiblePoints.length),
  });
}

export function parseVisualizationSpec(value: unknown): VisualizationSpec {
  return visualizationSpecSchema.parse(value);
}
