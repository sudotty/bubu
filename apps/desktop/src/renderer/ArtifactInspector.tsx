import { useMemo, useState, type ReactNode } from "react";
import type { ConversationThread } from "../shared/product-api.js";
import { ResultVisualization } from "./ResultVisualization.js";
import { useConversationThread } from "./useConversationThread.js";

type InspectorTab = "summary" | "data" | "chart" | "plan" | "audit";

const labels: Record<InspectorTab, string> = { summary: "摘要", data: "数据", chart: "图表", plan: "计划", audit: "审计" };

function latestArtifacts(thread: ConversationThread | null | undefined) {
  const entries = thread?.entries ?? [];
  const resultEntry = [...entries].reverse().find((entry) => entry.kind === "result");
  const planEntry = [...entries].reverse().find((entry) => entry.kind === "plan");
  return { result: resultEntry?.kind === "result" ? resultEntry.payload.result : undefined, plan: planEntry?.kind === "plan" ? planEntry.payload.proposal : undefined };
}

export function ArtifactInspector({ target, threadId, fallback }: { readonly target: { readonly kind: "dataset" | "group"; readonly id: string }; readonly threadId: string | undefined; readonly fallback: ReactNode }) {
  const [tab, setTab] = useState<InspectorTab>("summary");
  const thread = useConversationThread(target, threadId);
  const artifacts = useMemo(() => latestArtifacts(thread), [thread]);
  const result = artifacts.result;
  const plan = artifacts.plan;

  if (!threadId || !thread || (!result && !plan)) return <>{fallback}</>;
  return <>
    <header className="artifact-header"><div><p className="hero-kicker">LOCAL ARTIFACT</p><h3>{plan?.plan.purpose ?? thread.title}</h3></div><span>仅本地</span></header>
    <nav className="artifact-tabs" aria-label="结果检查器">
      {(Object.keys(labels) as InspectorTab[]).map((item) => <button type="button" key={item} className={tab === item ? "artifact-tab-active" : ""} aria-pressed={tab === item} onClick={() => setTab(item)}>{labels[item]}</button>)}
    </nav>
    <div className="artifact-body">
      {tab === "summary" && <section className="artifact-summary"><strong>{result ? `${result.rows.length} 行本地结果` : "计划待审批"}</strong><p>{result ? "这份结果由已审查计划在 Go 数据内核执行；并没有把原始行发送给模型。" : "请先在对话中审查计划，再明确批准本地执行。"}</p>{result?.truncated && <small>结果已按照计划的上限截断。</small>}</section>}
      {tab === "data" && (result ? <div className="table-scroll artifact-table"><table><thead><tr>{result.columns.map((column) => <th key={column.label}>{column.label}<small>{column.type}</small></th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={result.columns[cellIndex]?.label ?? cellIndex}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody></table></div> : <p className="empty-copy">批准执行后，受限结果会出现在这里。</p>)}
      {tab === "chart" && (result ? <ResultVisualization result={result} title={plan?.plan.purpose ?? thread.title} /> : <p className="empty-copy">查询结果生成后才会提供确定性图表。</p>)}
      {tab === "plan" && (plan ? <section className="artifact-plan"><strong>{plan.plan.purpose}</strong><dl><div><dt>维度</dt><dd>{plan.plan.dimensions.length || "无"}</dd></div><div><dt>计算</dt><dd>{plan.plan.measures.length || "明细"}</dd></div><div><dt>最多返回</dt><dd>{plan.plan.limit} 行</dd></div></dl><p>模型仅接收可见的结构与本地合成示例；执行只接受经过确定性验证的类型化计划。</p></section> : <p className="empty-copy">本线程尚未生成查询计划。</p>)}
      {tab === "audit" && <section className="artifact-audit"><strong>可追溯的本地证据</strong><p>{thread.entries.length} 条追加记录 · 所有计划、结果与错误都保存在当前设备。</p><p>远程模型输入与结果执行分别受披露审计和 Go 数据内核约束。</p></section>}
    </div>
  </>;
}
