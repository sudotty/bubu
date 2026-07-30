export type TaskStarterKind = "dataset" | "group";

export interface TaskStarter {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly question: string;
}

export type WorkspaceTaskId = "clean" | "compare" | "reconcile" | "merge" | "analyze" | "repeat";

export type WorkspaceTaskStarter =
  | { readonly id: WorkspaceTaskId; readonly label: string; readonly description: string; readonly status: "implemented"; readonly actionLabel: string }
  | { readonly id: WorkspaceTaskId; readonly label: string; readonly description: string; readonly status: "planned" };

export const emptyWorkspaceTaskStarters: readonly WorkspaceTaskStarter[] = [
  { id: "clean", label: "Clean", description: "用本地模板清理数据并查看版本证据", status: "implemented", actionLabel: "用示例开始 Clean" },
  { id: "analyze", label: "Analyze", description: "导入后提出问题，审查计划再本地查询", status: "implemented", actionLabel: "用示例开始 Analyze" },
  { id: "repeat", label: "Repeat", description: "保存受审任务，在新版本到达后安全重放", status: "implemented", actionLabel: "用示例了解 Repeat" },
  { id: "compare", label: "Compare", description: "按受审键、容差和基数比较两个版本化对象", status: "implemented", actionLabel: "打开对账示例 Compare" },
  { id: "reconcile", label: "Reconcile", description: "生成控制总额与未匹配项证据", status: "implemented", actionLabel: "打开对账示例 Reconcile" },
  { id: "merge", label: "Merge", description: "追加同结构周期导出，预览影响后生成不可变对象", status: "implemented", actionLabel: "打开周期导出 Merge" },
] as const;

const datasetStarters: readonly TaskStarter[] = [
  { id: "overview", label: "快速概览", description: "先看数据由什么组成", question: "按最合适的分类字段分组统计记录数，并按数量从高到低排序" },
  { id: "trend", label: "趋势变化", description: "沿时间查看变化", question: "选择最合适的时间字段和数值字段，按时间汇总并展示变化趋势" },
  { id: "compare", label: "分组对比", description: "比较业务维度差异", question: "按最合适的分类字段分组，计算主要数值字段的总和与平均值，并按总和排序" },
  { id: "detail", label: "查看明细", description: "从前 20 行开始核对", question: "展示前 20 行明细，保留最有助于识别记录的字段" },
] as const;

const groupStarters: readonly TaskStarter[] = [
  { id: "join-overview", label: "关联概览", description: "用已确认关系汇总", question: "使用已确认的关系关联这些数据对象，按最合适的业务维度统计记录数" },
  { id: "join-compare", label: "跨表对比", description: "比较关联后的指标", question: "使用已确认的关系关联这些数据对象，按共同业务维度比较主要数值指标" },
  { id: "join-detail", label: "关联明细", description: "先核对少量关联行", question: "使用已确认的关系进行左关联，展示前 20 行关联明细" },
] as const;

export function taskStartersFor(kind: TaskStarterKind): readonly TaskStarter[] {
  return kind === "dataset" ? datasetStarters : groupStarters;
}
