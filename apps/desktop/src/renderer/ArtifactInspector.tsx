import { ArrowDownUp, Bot, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConversationEntry, ConversationThread, SafeGroupQueryResult, SafeQueryResult } from "../shared/product-api.js";
import { ResultVisualization } from "./ResultVisualization.js";
import { useConversationThread } from "./useConversationThread.js";
import { WorkflowPanel } from "./WorkflowPanel.js";

type InspectorTab = "summary" | "data" | "visual" | "evidence";
type LocalResult = SafeQueryResult | SafeGroupQueryResult;

const labels: Record<InspectorTab, string> = { summary: "摘要", data: "数据", visual: "可视化", evidence: "证据" };

function latestArtifacts(thread: ConversationThread | null | undefined) {
  const entries = thread?.entries ?? [];
  const resultEntry = entries.findLast((entry) => entry.kind === "result");
  const planEntry = entries.findLast((entry) => entry.kind === "plan");
  return { result: resultEntry?.kind === "result" ? resultEntry.payload.result : undefined, plan: planEntry?.kind === "plan" ? planEntry.payload.proposal : undefined };
}

function eventLabel(entry: ConversationEntry): string {
  return { question: "用户问题", plan: "类型化计划", result: "本地结果", insight: "模型解释", error: "运行错误" }[entry.kind];
}

function cellText(value: unknown): string {
  return value === null ? "" : String(value);
}

function ResultTable({ result }: { readonly result: LocalResult }) {
  const [filter, setFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<number>();
  const [descending, setDescending] = useState(false);
  const rows = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase();
    const filtered = normalized ? result.rows.filter((row) => row.some((cell) => cellText(cell).toLocaleLowerCase().includes(normalized))) : [...result.rows];
    if (sortColumn === undefined) return filtered;
    return filtered.toSorted((left, right) => cellText(left[sortColumn]).localeCompare(cellText(right[sortColumn]), "zh-CN", { numeric: true }) * (descending ? -1 : 1));
  }, [descending, filter, result.rows, sortColumn]);

  return <section className="artifact-data-view">
    <label><span>筛选当前结果</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="输入任意单元格内容" /></label>
    <div className="table-scroll artifact-table"><table><caption className="sr-only">当前任务的本地查询结果</caption><thead><tr>{result.columns.map((column, index) => <th scope="col" key={column.label}><button type="button" onClick={() => { setDescending(sortColumn === index ? !descending : false); setSortColumn(index); }}>{column.label}<small>{column.type}</small><ArrowDownUp size={12} aria-hidden="true" /></button></th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={result.columns[cellIndex]?.label ?? cellIndex}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody></table></div>
    <small>显示 {rows.length}/{result.rows.length} 行{result.truncated ? " · 原结果已按计划截断" : ""}</small>
  </section>;
}

export function ArtifactInspector({ target, threadId, fallback }: { readonly target: { readonly kind: "dataset" | "group"; readonly id: string }; readonly threadId: string | undefined; readonly fallback: ReactNode }) {
  const [tab, setTab] = useState<InspectorTab>("summary");
  const [expanded, setExpanded] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  const thread = useConversationThread(target, threadId);
  const artifacts = useMemo(() => latestArtifacts(thread), [thread]);
  const result = artifacts.result;
  const plan = artifacts.plan;

  useEffect(() => {
    setTab("summary");
    setAutomationOpen(false);
    setExpanded(false);
  }, [threadId]);

  if (!threadId || !thread || (!result && !plan)) return <>{fallback}</>;
  const draft = plan ? ("datasetId" in plan.plan ? { kind: "dataset-query" as const, plan: plan.plan } : { kind: "group-query" as const, groupPlan: plan.plan }) : undefined;
  return <div className={`artifact-shell ${expanded ? "artifact-shell-expanded" : ""}`}>
    <header className="artifact-header"><div><p className="hero-kicker">LOCAL ARTIFACT</p><h3>{plan?.plan.purpose ?? thread.title}</h3></div><div className="artifact-header-actions"><span>仅本地</span><button type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "收起结果工作区" : "展开结果工作区"}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div></header>
    {automationOpen ? <div className="artifact-automation-workspace"><header><button type="button" onClick={() => setAutomationOpen(false)}><X size={15} />返回结果</button><strong>当前任务自动化</strong></header><WorkflowPanel target={target} threadId={threadId} draft={draft} /></div> : <>
      <nav className="artifact-tabs" aria-label="结果检查器" role="tablist">
        {(Object.keys(labels) as InspectorTab[]).map((item) => <button type="button" role="tab" key={item} className={tab === item ? "artifact-tab-active" : ""} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} onClick={() => setTab(item)} onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []); const index = tabs.indexOf(event.currentTarget); const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; next?.focus(); next?.click(); }}>{labels[item]}</button>)}
      </nav>
      <div className="artifact-body" role="tabpanel">
        {tab === "summary" && <section className="artifact-summary"><div className="artifact-metrics"><span><strong>{result?.rows.length ?? 0}</strong>结果行</span><span><strong>{result?.columns.length ?? 0}</strong>结果列</span><span><strong>{thread.entries.length}</strong>证据事件</span></div><p>{result ? "经过审查的计划已由本地 Go 数据内核执行，原始行没有自动发送给模型。" : "计划已保存，等待你在对话中批准本地执行。"}</p>{result?.truncated && <small>结果已按照计划上限截断。</small>}<button type="button" className="secondary-action artifact-automation-action" onClick={() => { setAutomationOpen(true); setExpanded(true); }}><Bot size={15} />把已审查计划变成自动化</button></section>}
        {tab === "data" && (result ? <ResultTable result={result} /> : <p className="empty-copy">批准执行后，受限结果会出现在这里。</p>)}
        {tab === "visual" && (result ? <ResultVisualization result={result} title={plan?.plan.purpose ?? thread.title} /> : <p className="empty-copy">查询结果生成后才会提供确定性图表。</p>)}
        {tab === "evidence" && <section className="artifact-evidence">{plan && <div className="artifact-plan"><strong>{plan.plan.purpose}</strong><dl><div><dt>维度</dt><dd>{plan.plan.dimensions.length || "无"}</dd></div><div><dt>计算</dt><dd>{plan.plan.measures.length || "明细"}</dd></div><div><dt>最多返回</dt><dd>{plan.plan.limit} 行</dd></div></dl></div>}<ol>{thread.entries.map((entry) => <li key={entry.id}><span>{eventLabel(entry)}</span><strong>{new Date(entry.createdAt).toLocaleString("zh-CN")}</strong><small>第 {entry.ordinal} 条追加记录</small></li>)}</ol></section>}
      </div>
    </>}
  </div>;
}
