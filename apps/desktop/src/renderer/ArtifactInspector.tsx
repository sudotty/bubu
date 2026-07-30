import { ArrowDownUp, Bot, Copy, Database, Download, FileText, Maximize2, Minimize2, Pin, PinOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ConversationEntry, ConversationThread, DatasetGroupCadence, DatasetSummary, SafeGroupQueryResult, SafeQueryResult } from "../shared/product-api.js";
import { ResultVisualization } from "./ResultVisualization.js";
import { useConversationThread } from "./useConversationThread.js";
import { WorkflowPanel } from "./WorkflowPanel.js";
import { recordProductMetric } from "./product-metrics.js";
import { latestTaskSnapshot } from "./task-lifecycle.js";
import { resultTypeLabel } from "./result-type-label.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { composeVisualizations } from "@bubu/contracts";

type InspectorTab = "summary" | "data" | "visual" | "evidence";
type LocalResult = SafeQueryResult | SafeGroupQueryResult;

const labels: Record<InspectorTab, string> = { summary: "摘要", data: "数据", visual: "可视化", evidence: "证据" };

function latestArtifacts(thread: ConversationThread | null | undefined) {
  const snapshot = latestTaskSnapshot(thread?.entries ?? []);
  return { result: snapshot.result?.payload.result, plan: snapshot.plan?.payload.proposal };
}

function eventLabel(entry: ConversationEntry): string {
  return { question: "用户问题", plan: "类型化计划", result: "本地结果", insight: "模型解释", error: "运行错误" }[entry.kind];
}

function cellText(value: unknown): string {
  return value === null ? "" : String(value);
}

function ResultTable({ result, title, targetKind, pinned, onTogglePinned }: { readonly result: LocalResult; readonly title: string; readonly targetKind: "dataset" | "group"; readonly pinned: boolean; readonly onTogglePinned: () => void }) {
  const [filter, setFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<number>();
  const [descending, setDescending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const rows = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase();
    const filtered = normalized ? result.rows.filter((row) => row.some((cell) => cellText(cell).toLocaleLowerCase().includes(normalized))) : [...result.rows];
    if (sortColumn === undefined) return filtered;
    return filtered.toSorted((left, right) => cellText(left[sortColumn]).localeCompare(cellText(right[sortColumn]), "zh-CN", { numeric: true }) * (descending ? -1 : 1));
  }, [descending, filter, result.rows, sortColumn]);
  const actionInput = { title, columns: result.columns.map(({ label }) => label), rows };
  const copyCurrentView = async () => {
    try {
      const outcome = await window.bubu.artifacts.copyTable(actionInput);
      setNotice(`已复制表头与 ${outcome.rowCount} 行当前结果`);
      recordProductMetric({ name: "artifact_copied", targetKind, outcome: "succeeded", rowCount: outcome.rowCount, columnCount: actionInput.columns.length });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "复制失败，请重试");
    }
  };
  const exportCurrentView = async () => {
    try {
      const outcome = await window.bubu.artifacts.exportTable(actionInput);
      setNotice(outcome.status === "exported" ? `已导出 ${outcome.rowCount} 行当前结果` : "已取消导出");
      recordProductMetric({ name: "artifact_exported", targetKind, outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: outcome.rowCount, columnCount: actionInput.columns.length } : {}) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导出失败，请重试");
    }
  };

  return <section className="artifact-data-view">
    <div className="artifact-data-toolbar"><label><span>筛选当前结果</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="输入任意单元格内容" /></label><div><button type="button" onClick={() => void copyCurrentView()}><Copy size={14} />复制</button><button type="button" onClick={() => void exportCurrentView()}><Download size={14} />导出当前视图</button><button type="button" aria-pressed={pinned} onClick={onTogglePinned}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}{pinned ? "取消固定" : "固定"}</button></div></div>
    <div className="table-scroll artifact-table"><table><caption className="sr-only">当前任务的本地查询结果</caption><thead><tr>{result.columns.map((column, index) => {
      const active = sortColumn === index;
      const direction = active ? (descending ? "descending" : "ascending") : "none";
      return <th scope="col" aria-sort={direction} key={column.label}><button type="button" aria-label={`${column.label}，${active ? descending ? "当前降序，切换为升序" : "当前升序，切换为降序" : "按此列升序排列"}`} onClick={() => { setDescending(active ? !descending : false); setSortColumn(index); }}>{column.label}<small>{resultTypeLabel(column.type)}</small><ArrowDownUp size={12} aria-hidden="true" /></button></th>;
    })}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={result.columns[cellIndex]?.label ?? cellIndex}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody></table></div>
    <small>显示 {rows.length}/{result.rows.length} 行{result.truncated ? " · 原结果已按计划截断" : ""}</small>{notice && <p className="artifact-action-notice" role="status">{notice}</p>}
  </section>;
}

const pinnedArtifactKey = "bubu:pinned-artifacts:v1";

function readPinnedArtifacts(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(pinnedArtifactKey) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && /^[0-9a-f]{32}$/u.test(item)) : []);
  } catch {
    return new Set();
  }
}

export function ArtifactInspector({ target, threadId, fallback, initialView = "artifacts", workflowCadence, onReturnToConversation, onDatasetMaterialized }: { readonly target: { readonly kind: "dataset" | "group"; readonly id: string }; readonly threadId: string | undefined; readonly fallback: ReactNode; readonly initialView?: "artifacts" | "workflow"; readonly workflowCadence?: DatasetGroupCadence; readonly onReturnToConversation?: () => void; readonly onDatasetMaterialized?: (dataset: DatasetSummary) => void }) {
  const [tab, setTab] = useState<InspectorTab>("summary");
  const [expanded, setExpanded] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [pinned, setPinned] = useState(() => threadId ? readPinnedArtifacts().has(threadId) : false);
  const [reportNotice, setReportNotice] = useState<string>();
  const [reportTitle, setReportTitle] = useState("");
  const [reportSummary, setReportSummary] = useState("经审查计划在本地数据内核执行的确定性结果。");
  const [reportIncludeChartData, setReportIncludeChartData] = useState(true);
  const [reportIncludeLineage, setReportIncludeLineage] = useState(true);
  const [reportIncludeRunMetadata, setReportIncludeRunMetadata] = useState(true);
  const [reportIncludeLimitations, setReportIncludeLimitations] = useState(true);
  const [reportBusy, setReportBusy] = useState(false);
  const [derivedName, setDerivedName] = useState("");
  const [materializing, setMaterializing] = useState(false);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const artifactShellRef = useRef<HTMLDivElement>(null);
  const thread = useConversationThread(target, threadId);
  const artifacts = useMemo(() => latestArtifacts(thread), [thread]);
  const result = artifacts.result;
  const plan = artifacts.plan;

  useEffect(() => {
    setReportTitle(plan?.plan.purpose ?? thread?.title ?? "本地分析报告");
    setReportSummary("经审查计划在本地数据内核执行的确定性结果。");
    setReportIncludeChartData(true);
    setReportIncludeLineage(true);
    setReportIncludeRunMetadata(true);
    setReportIncludeLimitations(true);
  }, [plan?.plan.purpose, thread?.title, threadId]);

  useEffect(() => {
    setTab("summary");
    setAutomationOpen(initialView === "workflow");
    setExpanded(false);
    setPinned(threadId ? readPinnedArtifacts().has(threadId) : false);
    setReportNotice(undefined);
    setDerivedName("");
  }, [initialView, threadId]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
        requestAnimationFrame(() => expandButtonRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(artifactShellRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, [tabindex="0"]') ?? []);
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = (currentIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const draft = plan ? ("datasetId" in plan.plan ? { kind: "dataset-query" as const, plan: plan.plan } : { kind: "group-query" as const, groupPlan: plan.plan }) : undefined;
  if (initialView === "workflow") return <div className="artifact-shell workflow-shell"><WorkflowPanel target={target} threadId={threadId ?? ""} draft={draft} defaultTriggerPreset={workflowCadence === "one-off" ? "manual" : workflowCadence} onReturnToConversation={onReturnToConversation} /></div>;
  if (!threadId || !thread || (!result && !plan)) return <section className="artifact-empty-state"><div><p className="hero-kicker">任务结果</p><h3>{threadId ? "当前任务还没有结果" : "先开始一个数据任务"}</h3><p>{threadId ? "提出问题并批准计划后，本地结果、图表和证据会集中显示在这里。" : "结果属于具体任务。关闭此面板并创建任务后再开始提问。"}</p>{onReturnToConversation && <button type="button" className="primary-action" onClick={onReturnToConversation}>返回数据对话</button>}</div><details className="artifact-context-fallback"><summary>查看数据结构与健康</summary>{fallback}</details></section>;
  const togglePinned = () => {
    const values = readPinnedArtifacts();
    if (values.has(threadId)) values.delete(threadId); else values.add(threadId);
    localStorage.setItem(pinnedArtifactKey, JSON.stringify([...values]));
    setPinned(values.has(threadId));
    setReportNotice(values.has(threadId) ? "已固定此结果；再次打开当前任务时会保留固定状态。" : "已取消固定此结果。");
    recordProductMetric({ name: "artifact_pinned", targetKind: target.kind, outcome: "succeeded" });
  };
  const exportReport = async () => {
    if (!result || !reportTitle.trim() || !reportSummary.trim()) return;
    setReportBusy(true);
    try {
      const title = reportTitle.trim();
      const visualization = composeVisualizations(result, title);
      const chartTables = reportIncludeChartData && visualization.kind === "charts"
        ? visualization.composition.views.map((view) => ({ name: `图表数据 · ${view.valueLabel}`.slice(0, 100), columns: [view.categoryLabel, view.valueLabel], rows: view.points.map(({ label, value }) => [label, value]) }))
        : [];
      const outcome = await window.bubu.artifacts.exportReport({
        schemaVersion: 1, kind: "analysis", title, summary: reportSummary.trim(),
        deterministicFacts: [{ label: "结果行数", value: result.rows.length }, { label: "结果列数", value: result.columns.length }, { label: "是否截断", value: result.truncated }],
        tables: [{ name: "本地结果", columns: result.columns.map(({ label }) => label), rows: result.rows }, ...chartTables], quality: [], exceptions: [],
        limitations: reportIncludeLimitations ? [result.truncated ? "结果已按受审计划的行数预算截断。" : "报告只包含当前受审本地结果。"] : [],
        lineage: reportIncludeLineage && plan ? [{ label: "计划目的", value: plan.plan.purpose }] : [],
        runMetadata: reportIncludeRunMetadata ? [{ label: "任务标识", value: thread.id }, { label: "事实来源", value: "本地确定性执行" }] : [],
      });
      setReportNotice(outcome.status === "exported" ? `已生成专业报告包“${outcome.bundleName}” · ${outcome.fileCount} 个文件` : "已取消报告导出");
      recordProductMetric({ name: "artifact_exported", targetKind: target.kind, outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: result.rows.length, columnCount: result.columns.length } : {}) });
      recordProductMetric({ name: "report_bundle_exported", targetKind: target.kind, outcome: outcome.status === "exported" ? "succeeded" : "cancelled", ...(outcome.status === "exported" ? { rowCount: result.rows.length, columnCount: result.columns.length } : {}) });
    } catch (error) {
      setReportNotice(error instanceof Error ? error.message : "报告导出失败，请重试");
    } finally {
      setReportBusy(false);
    }
  };
  const materializeDerived = async () => {
    if (!draft || !result || !derivedName.trim()) return;
    setMaterializing(true);
    setReportNotice(undefined);
    try {
      const outcome = await window.bubu.datasets.materializeDerived({ displayName: derivedName, transformation: draft }, createOperationId());
      setReportNotice(`已创建数据对象“${outcome.dataset.displayName}”`);
      onDatasetMaterialized?.(outcome.dataset);
    } catch (error) {
      setReportNotice(operationErrorMessage(error, "保存派生数据对象失败"));
    } finally {
      setMaterializing(false);
    }
  };
  return <div ref={artifactShellRef} className={`artifact-shell ${expanded ? "artifact-shell-expanded" : ""}`} {...(expanded ? { role: "dialog", "aria-modal": true, "aria-label": "展开的本地结果" } : {})}>
    <header className="artifact-header"><div><p className="hero-kicker">本地结果</p><h3>{plan?.plan.purpose ?? thread.title}</h3></div><div className="artifact-header-actions"><span>仅本地</span><button ref={expandButtonRef} type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "收起结果工作区" : "展开结果工作区"}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div></header>
    {automationOpen ? <div className="artifact-automation-workspace"><header><button type="button" onClick={() => setAutomationOpen(false)}><X size={15} />返回结果</button><strong>当前任务自动化</strong></header><WorkflowPanel target={target} threadId={threadId} draft={draft} defaultTriggerPreset={workflowCadence === "one-off" ? "manual" : workflowCadence} /></div> : <>
      <nav className="artifact-tabs" aria-label="结果检查器" role="tablist">
        {(Object.keys(labels) as InspectorTab[]).map((item) => <button type="button" role="tab" key={item} className={tab === item ? "artifact-tab-active" : ""} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []); const index = tabs.indexOf(event.currentTarget); const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; next?.focus(); next?.click(); }}>{labels[item]}</button>)}
      </nav>
      <div className="artifact-body" role="tabpanel">
        {tab === "summary" && <section className="artifact-summary">
          <div className="artifact-metrics"><span><strong>{result?.rows.length ?? 0}</strong>结果行</span><span><strong>{result?.columns.length ?? 0}</strong>结果列</span><span><strong>{thread.entries.length}</strong>证据事件</span></div>
          <p>{result ? "经过审查的计划已在本地执行，原始行没有自动发送给模型。" : "计划已保存，等待你在对话中批准本地执行。"}</p>
          {result?.truncated && <small>结果已按照计划上限截断。</small>}
          <div className="artifact-summary-actions"><button type="button" className="secondary-action artifact-automation-action" onClick={() => { setAutomationOpen(true); setExpanded(true); }}><Bot size={15} />保存为工作流</button></div>
          {result && <details className="report-composer"><summary><FileText size={15} />组合专业报告</summary><div>
            <label><span>报告标题</span><input value={reportTitle} maxLength={200} onChange={(event) => setReportTitle(event.target.value)} /></label>
            <label><span>执行摘要</span><textarea value={reportSummary} maxLength={2_000} rows={3} onChange={(event) => setReportSummary(event.target.value)} /></label>
            <fieldset><legend>报告组成</legend><label><input type="checkbox" checked={reportIncludeChartData} onChange={(event) => setReportIncludeChartData(event.target.checked)} /><span>每个安全可视化的独立数据 Sheet</span></label><label><input type="checkbox" checked={reportIncludeLineage} onChange={(event) => setReportIncludeLineage(event.target.checked)} /><span>受审计划血缘</span></label><label><input type="checkbox" checked={reportIncludeRunMetadata} onChange={(event) => setReportIncludeRunMetadata(event.target.checked)} /><span>运行元数据</span></label><label><input type="checkbox" checked={reportIncludeLimitations} onChange={(event) => setReportIncludeLimitations(event.target.checked)} /><span>限制与截断说明</span></label></fieldset>
            <p>完整本地结果与确定性事实始终保留；可选图表 Sheet 只重排已批准单元格，不新增聚合。HTML、PDF、XLSX、CSV 和 manifest 由同一严格输入原子生成。</p>
            <button type="button" className="primary-action" disabled={reportBusy || !reportTitle.trim() || !reportSummary.trim()} onClick={() => void exportReport()}>{reportBusy ? "正在生成…" : "生成专业报告包"}</button>
          </div></details>}
          {result && draft && <details className="derived-materialize"><summary><Database size={15} />保存为数据对象</summary><div><label><span>新数据对象名称</span><input value={derivedName} onChange={(event) => setDerivedName(event.target.value)} maxLength={100} placeholder={`${plan?.plan.purpose ?? thread.title} · 派生`} /></label><p>将当前已批准计划的结果物化为不可变版本，并保留全部上游版本和计划指纹。之后可以继续查询、关联或生成下一层对象。</p><button type="button" className="primary-action" disabled={materializing || !derivedName.trim()} onClick={() => void materializeDerived()}>{materializing ? "正在保存…" : `保存当前计划结果${result.truncated ? "（含行数上限）" : ""}`}</button></div></details>}
          {reportNotice && <p className="artifact-action-notice" role="status">{reportNotice}</p>}
        </section>}
        {tab === "data" && (result ? <ResultTable result={result} title={plan?.plan.purpose ?? thread.title} targetKind={target.kind} pinned={pinned} onTogglePinned={togglePinned} /> : <p className="empty-copy">批准执行后，受限结果会出现在这里。</p>)}
        {tab === "visual" && (result ? <ResultVisualization result={result} title={plan?.plan.purpose ?? thread.title} /> : <p className="empty-copy">查询结果生成后才会提供确定性图表。</p>)}
        {tab === "evidence" && <section className="artifact-evidence">{plan && <div className="artifact-plan"><strong>{plan.plan.purpose}</strong><dl><div><dt>维度</dt><dd>{plan.plan.dimensions.length || "无"}</dd></div><div><dt>计算</dt><dd>{plan.plan.measures.length || "明细"}</dd></div><div><dt>最多返回</dt><dd>{plan.plan.limit} 行</dd></div></dl></div>}<ol>{thread.entries.map((entry) => <li key={entry.id}><span>{eventLabel(entry)}</span><strong>{new Date(entry.createdAt).toLocaleString("zh-CN")}</strong><small>第 {entry.ordinal} 条追加记录</small></li>)}</ol></section>}
      </div>
    </>}
  </div>;
}
