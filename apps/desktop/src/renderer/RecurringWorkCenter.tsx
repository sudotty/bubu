import { AlertTriangle, CheckCircle2, Clock3, FileInput, FolderSearch, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deriveRecurringWorkItems, type RecurringWorkItem } from "@bubu/product-core";
import type { DatasetGroup, DatasetReplacementSelectionResult, DatasetSummary, FileArrivalItem, FileArrivalState, WorkflowRun } from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { recordProductMetric } from "./product-metrics.js";

const stateLabels = { "waiting-file": "等待新文件", running: "正在运行", "needs-attention": "需要处理", completed: "已完成", scheduled: "已计划" } as const;
const reasonLabels: Record<string, string> = { "schema-drift": "列结构发生变化", "quality-block": "质量门禁阻断", "quality-change": "来源质量低于受审基线", "cardinality-change": "匹配基数发生变化", "control-total-change": "控制总额超出受审基线", "stale-source": "已被更新版本取代", "execution-error": "本地确定性执行失败", "workflow-failed": "工作流执行失败" };

type MappingRequired = Extract<DatasetReplacementSelectionResult, { readonly status: "mapping-required" }>;

export function RecurringWorkCenter({ datasets, groups, onOpen, onMappingRequired, onDatasetReplaced }: { readonly datasets: readonly DatasetSummary[]; readonly groups: readonly DatasetGroup[]; readonly onOpen: (target: { readonly kind: "dataset" | "group"; readonly id: string }, openReconciliation: boolean) => void; readonly onMappingRequired: (value: MappingRequired) => void; readonly onDatasetReplaced: (dataset: DatasetSummary) => Promise<void> }) {
  const [items, setItems] = useState<readonly RecurringWorkItem[]>([]);
  const [arrivals, setArrivals] = useState<FileArrivalState>({ configured: false, watchStatus: "inactive", items: [] });
  const [arrivalTargets, setArrivalTargets] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const targets = useMemo(() => [...datasets.map(({ id }) => ({ kind: "dataset" as const, id })), ...groups.map(({ id }) => ({ kind: "group" as const, id }))], [datasets, groups]);

  async function refresh(): Promise<void> {
    const [arrivalState, recomputeLists, reconciliationLists, workflowLists] = await Promise.all([
      window.bubu.fileArrivals.list(),
      Promise.all(datasets.map(({ id }) => window.bubu.datasets.recomputeEvents(id))),
      Promise.all(groups.map(({ members }) => window.bubu.reconciliation.replayEvents(members.map(({ id }) => id)))),
      Promise.all(targets.map((target) => window.bubu.workflows.list(target))),
    ]);
    setArrivals(arrivalState);
    if (arrivalState.watchStatus === "unavailable") setNotice(arrivalState.watchMessage ?? "周期文件夹监听不可用，请重新批准文件夹。");
    setArrivalTargets((current) => Object.fromEntries(arrivalState.items.map((item) => [item.id, current[item.id] ?? item.candidates[0]?.datasetId ?? ""])));
    const workflowMap = new Map(workflowLists.flat().map((workflow) => [workflow.id, workflow]));
    const runPairs = await Promise.all([...workflowMap.values()].map(async (workflow) => [workflow.id, await window.bubu.workflows.runs(workflow.id)] as const));
    const latestRuns = new Map<string, WorkflowRun | null>(runPairs.map(([id, runs]) => [id, runs.toSorted((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null]));
    const groupForDataset = new Map(groups.flatMap((group) => group.members.map(({ id }) => [id, { id: group.id, name: group.name }] as const)));
    setItems(deriveRecurringWorkItems({
      recomputes: recomputeLists.flat(), reconciliations: reconciliationLists.flat(), groupForDataset,
      workflows: [...workflowMap.values()].map((workflow) => ({ id: workflow.id, name: workflow.name, target: workflow.target, triggerKind: workflow.trigger.kind, nextDueAt: workflow.nextDueAt, updatedAt: workflow.updatedAt, latestRun: latestRuns.get(workflow.id) ?? null })),
    }));
  }

  useEffect(() => {
    let active = true;
    const update = async () => { try { await refresh(); } catch (error) { if (active) setNotice(operationErrorMessage(error, "无法读取周期任务状态")); } };
    void update(); const timer = setInterval(() => void update(), 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [datasets, groups, targets]);

  async function recover(item: RecurringWorkItem): Promise<void> {
    setBusyId(item.id); setNotice(undefined);
    try {
      if (item.kind === "derived-recompute") await window.bubu.datasets.retryRecompute(item.id);
      else if (item.kind === "reconciliation-replay") await window.bubu.reconciliation.retryReplay(item.id);
      else await window.bubu.workflows.run(item.id, createOperationId());
      recordProductMetric({ name: "task_recovery_selected", targetKind: item.targetKind, outcome: "started" });
      recordProductMetric({ name: "recurring_run_recovered", targetKind: item.targetKind, outcome: "started" });
      await refresh(); setNotice("已按原受审定义重新执行；不会扩大数据披露或执行权限。");
    } catch (error) { setNotice(operationErrorMessage(error, "无法恢复这项周期任务")); } finally { setBusyId(undefined); }
  }

  async function configureArrivals(): Promise<void> {
    setBusyId("configure-arrivals"); setNotice(undefined);
    try { setArrivals(await window.bubu.fileArrivals.configure()); recordProductMetric({ name: "file_arrival_folder_approved", outcome: "succeeded" }); setNotice("只会识别这个已批准文件夹中的新 CSV、TSV 和 XLSX；替换前仍需确认。"); }
    catch (error) { setNotice(operationErrorMessage(error, "无法批准周期文件夹")); }
    finally { setBusyId(undefined); }
  }

  async function approveArrival(item: FileArrivalItem): Promise<void> {
    const datasetId = arrivalTargets[item.id];
    if (!datasetId) { setNotice("请先选择这个文件对应的数据对象。"); return; }
    setBusyId(item.id); setNotice(undefined);
    try {
      recordProductMetric({ name: "replacement_version_approved", targetKind: "dataset", outcome: "started" });
      recordProductMetric({ name: "recurring_run_started", targetKind: "dataset", outcome: "started" });
      const result = await window.bubu.fileArrivals.approve({ arrivalId: item.id, datasetId }, createOperationId());
      if (result.replacement.status === "mapping-required") {
        recordProductMetric({ name: "recurring_run_paused", targetKind: "dataset", outcome: "succeeded" });
        onMappingRequired(result.replacement);
        setNotice("列结构发生变化。请在数据工作区确认列映射；确认前当前版本不会改变。");
      } else if (result.replacement.status === "replaced") {
        await onDatasetReplaced(result.replacement.dataset);
        recordProductMetric({ name: "recurring_run_result_ready", targetKind: "dataset", outcome: "succeeded" });
        if (items.length > 0) recordProductMetric({ name: "next_cycle_returned", targetKind: "dataset", outcome: "succeeded" });
        setNotice("已创建不可变新版本，并交给现有周期任务队列处理。");
      } else throw new Error("到达文件审批不能返回取消状态");
      await refresh();
    } catch (error) { recordProductMetric({ name: "recurring_run_result_ready", targetKind: "dataset", outcome: "failed" }); setNotice(operationErrorMessage(error, "无法处理到达文件；没有创建部分版本")); }
    finally { setBusyId(undefined); }
  }

  async function dismissArrival(item: FileArrivalItem): Promise<void> {
    setBusyId(item.id); setNotice(undefined);
    try { setArrivals(await window.bubu.fileArrivals.dismiss(item.id)); setNotice("已忽略这个文件；不会创建版本或触发任务。"); }
    catch (error) { setNotice(operationErrorMessage(error, "无法忽略到达文件")); }
    finally { setBusyId(undefined); }
  }

  const visible = items.slice(0, 12);
  const counts = Object.fromEntries(Object.keys(stateLabels).map((state) => [state, items.filter((item) => item.state === state).length])) as Record<keyof typeof stateLabels, number>;
  const pendingArrivals = arrivals.items.filter(({ status }) => status !== "dismissed").slice(0, 8);
  return <section className="recurring-work-center" aria-label="周期工作中心"><header><div><p className="hero-kicker">周期工作中心</p><strong>等待、执行、处理与交付证据</strong><small>汇总文件到达、本地重算、对账与工作流；不创建新的执行调度器。</small></div><div className="recurring-work-header-actions"><button type="button" className="secondary-action" disabled={busyId !== undefined} onClick={() => void configureArrivals()}><FolderSearch size={13} />{arrivals.configured ? "更换批准文件夹" : "批准周期文件夹"}</button><button type="button" className="secondary-action" disabled={busyId !== undefined} onClick={() => void refresh()}><RefreshCw size={13} />刷新</button></div></header><div className="arrival-inbox"><div><strong>新文件到达</strong><small>{arrivals.configured ? `正在识别“${arrivals.folderLabel}”中的新表格；不会向界面暴露完整路径。` : "先批准一个本地文件夹；现有文件不会被自动替换。"}</small></div>{pendingArrivals.length === 0 ? <p className="empty-copy">尚无待审查的新文件。</p> : <ol>{pendingArrivals.map((item) => <li key={item.id} className={`is-${item.status}`}><FileInput size={16} /><div><strong>{item.fileName}</strong><small>{item.message ?? `检测于 ${new Date(item.detectedAt).toLocaleString("zh-CN")}；选择目标后才会创建版本。`}</small>{item.candidates.length > 0 && item.status !== "completed" && <label>替换目标<select value={arrivalTargets[item.id] ?? ""} onChange={(event) => setArrivalTargets((current) => ({ ...current, [item.id]: event.target.value }))}>{item.candidates.map((candidate) => <option key={candidate.datasetId} value={candidate.datasetId}>{candidate.displayName} · {candidate.confidence === "high" ? "历史来源一致" : candidate.confidence === "medium" ? "名称相近，需审查" : "仅格式兼容，需审查"}</option>)}</select></label>}</div><div>{item.status === "completed" ? <button type="button" className="secondary-action" onClick={() => { const datasetId = item.candidates[0]?.datasetId; if (datasetId) onOpen({ kind: "dataset", id: datasetId }, false); }}>打开版本</button> : <><button type="button" className="primary-action" disabled={busyId !== undefined || item.candidates.length === 0} onClick={() => void approveArrival(item)}>{busyId === item.id ? "处理中…" : item.status === "mapping-required" || item.status === "failed" ? "重新审查" : "确认并创建版本"}</button><button type="button" className="secondary-action" disabled={busyId !== undefined} onClick={() => void dismissArrival(item)}>忽略</button></>}</div></li>)}</ol>}</div><div className="recurring-work-counts">{Object.entries(stateLabels).map(([state, label]) => <span key={state}><strong>{counts[state as keyof typeof stateLabels]}</strong>{label}</span>)}</div>{visible.length === 0 ? <p className="empty-copy">尚无周期任务。保存工作流、派生规则或受审对账后会在这里统一出现。</p> : <ol>{visible.map((item) => <li key={`${item.kind}:${item.id}`} className={`is-${item.state}`}>{item.state === "needs-attention" ? <AlertTriangle size={16} /> : item.state === "completed" ? <CheckCircle2 size={16} /> : item.state === "waiting-file" ? <FileInput size={16} /> : <Clock3 size={16} />}<div><strong>{item.title}</strong><small>{stateLabels[item.state]} · {item.reasonKind ? reasonLabels[item.reasonKind] ?? item.reasonKind : item.nextAt ? `下次 ${new Date(item.nextAt).toLocaleString("zh-CN")}` : new Date(item.occurredAt).toLocaleString("zh-CN")}{item.attempt !== null ? ` · 尝试 ${item.attempt}/3` : ""}</small></div><div>{item.recoverable && <button type="button" className="secondary-action" disabled={busyId !== undefined} onClick={() => void recover(item)}>{busyId === item.id ? "正在恢复…" : "按原定义重试"}</button>}<button type="button" className="secondary-action" onClick={() => onOpen({ kind: item.targetKind, id: item.targetId }, item.kind === "reconciliation-replay")}>{item.state === "needs-attention" ? "查看原因" : item.state === "waiting-file" ? "前往替换" : "打开证据"}</button></div></li>)}</ol>}{notice && <p className="artifact-action-notice" role="status">{notice}</p>}</section>;
}
