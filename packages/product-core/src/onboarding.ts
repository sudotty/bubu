export interface DatasetStructureSnapshot {
  readonly id: string;
  readonly sourceName: string;
  readonly reconciliationContext: boolean;
  readonly columns: readonly { readonly name: string; readonly type: string; readonly nullCount: number }[];
}

export type RecommendedFirstTask =
  | { readonly kind: "import"; readonly title: string; readonly reason: string; readonly actionLabel: string }
  | { readonly kind: "clean" | "analyze" | "merge" | "reconcile" | "create-topic"; readonly title: string; readonly reason: string; readonly actionLabel: string };

function signature(snapshot: DatasetStructureSnapshot): string {
  return JSON.stringify(snapshot.columns.map(({ name, type }) => [name.trim().toLowerCase(), type]));
}

function sourceFamily(sourceName: string): string {
  return sourceName
    .replace(/\.[^.]+$/u, "")
    .toLowerCase()
    .replace(/(?:^|[-_\s])(?:20\d{2}(?:[-_]?\d{1,2}){0,2}|q[1-4]|w\d{1,2}|week[-_]?\d{1,2}|month[-_]?\d{1,2})(?=$|[-_\s])/giu, " ")
    .replace(/[-_\s]+/gu, " ")
    .trim();
}

function hasPeriodicEvidence(snapshots: readonly DatasetStructureSnapshot[]): boolean {
  const families = snapshots.map(({ sourceName }) => sourceFamily(sourceName));
  return families.every((family) => family.length > 0 && family === families[0])
    && new Set(snapshots.map(({ sourceName }) => sourceName.toLowerCase())).size > 1;
}

export function recommendFirstTask(snapshots: readonly DatasetStructureSnapshot[]): RecommendedFirstTask {
  if (snapshots.length === 0) return { kind: "import", title: "导入第一份业务表", reason: "工作区还没有可分析的数据对象。", actionLabel: "选择 Excel 或 CSV" };
  if (snapshots.length === 1) {
    const nullableColumns = snapshots[0]!.columns.filter(({ nullCount }) => nullCount > 0).length;
    return nullableColumns > 0
      ? { kind: "clean", title: "先检查并清理缺失值", reason: `检测到 ${nullableColumns} 列包含空值；先预览清理影响更稳妥。`, actionLabel: "打开 Clean 预览" }
      : { kind: "analyze", title: "从一个聚合问题开始", reason: "当前结构完整，适合先生成并审查一个本地查询计划。", actionLabel: "开始 Analyze" };
  }
  if (new Set(snapshots.map(signature)).size === 1 && hasPeriodicEvidence(snapshots)) {
    return { kind: "merge", title: "合并同结构周期文件", reason: `${snapshots.length} 个数据对象具有相同列名与类型，可先预览追加合并。`, actionLabel: "打开 Merge" };
  }
  const commonNames = snapshots
    .map(({ columns }) => new Set(columns.map(({ name }) => name.trim().toLowerCase())))
    .reduce((common, names) => new Set([...common].filter((name) => names.has(name))));
  if (commonNames.size > 0 && snapshots.some(({ reconciliationContext }) => reconciliationContext)) {
    return { kind: "reconcile", title: "核对跨表业务记录", reason: `检测到 ${commonNames.size} 个共同字段，且已有业务主题；请审查关系、基数和容差。`, actionLabel: "打开 Reconcile" };
  }
  return commonNames.size > 0
    ? { kind: "create-topic", title: "先确认跨表业务关系", reason: `检测到 ${commonNames.size} 个共同字段，但共同字段不等于业务关系；先创建主题并人工确认。`, actionLabel: "创建业务主题" }
    : { kind: "analyze", title: "先分别理解每份数据", reason: "未检测到可靠共同字段，不应自动猜测跨表关系。", actionLabel: "先分析当前数据" };
}
