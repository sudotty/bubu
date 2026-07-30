import { parseDerivedDatasetCreateInput, type DataCleanOperation, type DataCleanPlan } from "@bubu/contracts";

export type DataCleanRisk = "drops-columns" | "lossy-cast" | "drops-rows" | "deduplicates" | "fills-values" | "combines-sources";

const operationLabels: Readonly<Record<DataCleanOperation["kind"], string>> = {
  select: "选择并重排列",
  rename: "重命名列",
  cast: "转换类型",
  replace: "替换值",
  derive: "生成派生列",
  filter: "筛选行",
  deduplicate: "去除重复行",
  "fill-missing": "填补缺失值",
  append: "追加兼容数据",
  union: "按映射合并数据",
};

export interface DataCleanPlanSummary {
  readonly purpose: string;
  readonly sourceCount: number;
  readonly operationCount: number;
  readonly operationLabels: readonly string[];
  readonly risks: readonly DataCleanRisk[];
}

export function summarizeDataCleanPlan(plan: DataCleanPlan): DataCleanPlanSummary {
  const parsed = parseCleanPlan(plan);
  return {
    purpose: parsed.purpose,
    sourceCount: parsed.sources.length,
    operationCount: parsed.operations.length,
    operationLabels: parsed.operations.map(({ kind }) => operationLabels[kind]),
    risks: dataCleanPlanRisks(parsed),
  };
}

export function dataCleanPlanRisks(plan: DataCleanPlan): readonly DataCleanRisk[] {
  const kinds = new Set(plan.operations.map(({ kind }) => kind));
  return [
    ...(kinds.has("select") ? ["drops-columns" as const] : []),
    ...(kinds.has("cast") ? ["lossy-cast" as const] : []),
    ...(kinds.has("filter") ? ["drops-rows" as const] : []),
    ...(kinds.has("deduplicate") ? ["deduplicates" as const] : []),
    ...(kinds.has("fill-missing") ? ["fills-values" as const] : []),
    ...(kinds.has("append") || kinds.has("union") ? ["combines-sources" as const] : []),
  ];
}

/** Stable product evidence input; the Go authority independently SHA-256 hashes the exact stored typed plan. */
export function canonicalDataCleanPlan(plan: DataCleanPlan): string {
  return stableJson(parseCleanPlan(plan));
}

function parseCleanPlan(plan: DataCleanPlan): DataCleanPlan {
  const parsed = parseDerivedDatasetCreateInput({ displayName: "validation", transformation: { kind: "data-clean", cleanPlan: plan } });
  if (parsed.transformation.kind !== "data-clean") throw new Error("Expected a data-clean transformation");
  return parsed.transformation.cleanPlan;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}
