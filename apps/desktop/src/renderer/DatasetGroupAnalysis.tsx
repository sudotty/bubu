import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type {
  DatasetGroup,
  GroupQueryPlanProposal,
  SafeGroupQueryResult,
  OperationId,
} from "../shared/product-api.js";
import { ResultVisualization } from "./ResultVisualization.js";
import { ConversationHistory } from "./ConversationHistory.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { useConversationThread } from "./useConversationThread.js";
import { AggregateExplanationPanel } from "./AggregateExplanationPanel.js";
import { AggregateAgentPanel } from "./AggregateAgentPanel.js";
import { TaskRunStatus } from "./TaskRunStatus.js";
import { ChatAssistantMessage, ChatRecoveryMessage, ChatToolEvent, ChatUserMessage } from "./ChatMessage.js";
import { derivePersistedTaskState, isCancellation, type TaskLifecycleState } from "./task-lifecycle.js";

function messageFrom(error: unknown): string {
  return operationErrorMessage(error, "群组分析失败，请重试");
}

function sourceLabel(group: DatasetGroup, sourceIndex: number): string {
  return group.members[sourceIndex]?.displayName ?? `数据源 ${sourceIndex + 1}`;
}

function columnLabel(group: DatasetGroup, sourceIndex: number, column: string): string {
  return `${sourceLabel(group, sourceIndex)} · ${column}`;
}

function resultLabel(group: DatasetGroup, label: string): string {
  return label.replace(/^Source (\d+) · /u, (_match, rawIndex: string) => {
    const sourceIndex = Number(rawIndex) - 1;
    return `${sourceLabel(group, sourceIndex)} · `;
  });
}

export function DatasetGroupAnalysis({ group, threadId, onCreateThread }: { readonly group: DatasetGroup; readonly threadId?: string | undefined; readonly onCreateThread: () => Promise<void> }) {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string>();
  const [proposal, setProposal] = useState<GroupQueryPlanProposal>();
  const [result, setResult] = useState<SafeGroupQueryResult>();
  const [state, setState] = useState<TaskLifecycleState>("draft");
  const [error, setError] = useState<string>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [startedAt, setStartedAt] = useState<number>();
  const [completedAt, setCompletedAt] = useState<number>();
  const history = useConversationThread({ kind: "group", id: group.id }, threadId);

  useEffect(() => {
    setQuestion("");
    setSubmittedQuestion(undefined);
    setProposal(undefined);
    setResult(undefined);
    setState("draft");
    setError(undefined);
    setOperationId(undefined);
    setStartedAt(undefined);
    setCompletedAt(undefined);
  }, [group.id, group.updatedAt, threadId]);

  useEffect(() => {
    if (!history || !threadId || operationId || submittedQuestion) return;
    const persistedPlan = history.entries.findLast((entry) => entry.kind === "plan");
    const persistedResult = history.entries.findLast((entry) => entry.kind === "result");
    const persistedError = history.entries.findLast((entry) => entry.kind === "error");
    const persistedProposal = persistedPlan?.kind === "plan" ? persistedPlan.payload.proposal : undefined;
    setProposal(persistedProposal && "disclosedContexts" in persistedProposal ? persistedProposal : undefined);
    setResult(persistedResult?.kind === "result" && "groupId" in persistedResult.payload.result ? persistedResult.payload.result : undefined);
    setError(persistedError?.kind === "error" && (!persistedResult || persistedError.ordinal > persistedResult.ordinal) ? persistedError.payload.message : undefined);
    setState(derivePersistedTaskState(history.entries));
  }, [history, operationId, submittedQuestion, threadId]);

  async function propose(questionOverride?: string): Promise<void> {
    const normalized = (questionOverride ?? question).trim();
    if (!normalized) return;
    setSubmittedQuestion(normalized);
    setProposal(undefined);
    setResult(undefined);
    setError(undefined);
    setState("planning");
    setStartedAt(Date.now());
    setCompletedAt(undefined);
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    try {
      setProposal(await window.bubu.analysis.proposeGroup(
        { groupId: group.id, threadId, question: normalized },
        nextOperationId,
      ));
      setState("awaiting-approval");
    } catch (reason) {
      setError(isCancellation(reason) ? undefined : messageFrom(reason));
      setState(isCancellation(reason) ? "cancelled" : "needs-attention");
      setCompletedAt(Date.now());
    } finally {
      setOperationId((current) => current === nextOperationId ? undefined : current);
    }
  }

  async function execute(): Promise<void> {
    if (!proposal) return;
    setError(undefined);
    setState("executing");
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    try {
      if (!threadId) throw new Error("请先创建或选择一个对话任务");
      setResult(await window.bubu.analysis.executeGroup({ plan: proposal.plan, threadId }, nextOperationId));
      setState("completed");
      setCompletedAt(Date.now());
    } catch (reason) {
      setError(isCancellation(reason) ? undefined : messageFrom(reason));
      setState(isCancellation(reason) ? "cancelled" : "needs-attention");
      setCompletedAt(Date.now());
    } finally {
      setOperationId((current) => current === nextOperationId ? undefined : current);
    }
  }

  async function cancelOperation(): Promise<void> {
    if (!operationId) return;
    await window.bubu.operations.cancel(operationId);
  }

  const lastQuestion = history?.entries.findLast((entry) => entry.kind === "question");
  const recoverableQuestion = submittedQuestion ?? (lastQuestion?.kind === "question" ? lastQuestion.payload.question : undefined);
  const editRecoverableQuestion = () => {
    setQuestion(recoverableQuestion ?? question);
    setSubmittedQuestion(undefined);
    setProposal(undefined);
    setResult(undefined);
    setError(undefined);
    setState("draft");
  };

  return (
    <section className="analysis-panel group-analysis" aria-label={`与群组 ${group.name} 对话`}>
      <header className="analysis-header">
        <div><p className="chat-context-label">私密多表对话</p><h3>和群组对话</h3></div>
        <span className="mode-pill">等值关联 · 禁止笛卡尔积</span>
      </header>
      <TaskRunStatus state={state} startedAt={startedAt} completedAt={completedAt} />
      <ConversationHistory thread={history} group={group} hideQuestion={submittedQuestion} hideLatestResult={result !== undefined} />
      <div className="group-source-order">
        {group.members.map((member, index) => <span key={member.id}><strong>{index + 1}</strong>{member.displayName}</span>)}
      </div>
      {submittedQuestion && <ChatUserMessage><p>{submittedQuestion}</p></ChatUserMessage>}
      {state === "planning" && <ChatToolEvent busy>正在根据每个成员的结构和合成示例生成关联树…</ChatToolEvent>}
      {state === "cancelled" && <ChatAssistantMessage title="当前操作已取消"><p>群组关系与已保存的任务记录没有变化。你可以修改问题，或重新生成关联计划。</p></ChatAssistantMessage>}
      {state === "needs-attention" && <ChatRecoveryMessage message={error ?? "上次运行在生成关联计划前中断，群组任务记录已保留。"} actions={<><button type="button" className="primary-action" onClick={() => void propose(recoverableQuestion)} disabled={!recoverableQuestion}>重新生成关联计划</button><button type="button" className="secondary-action" onClick={editRecoverableQuestion}>修改问题</button></>} />}

      {proposal && (
        <article className="plan-card chat-approval-card">
          <header>
            <div><p className="chat-context-label">需要你的批准</p><h4>{proposal.plan.purpose}</h4></div>
            <span className={state === "completed" ? "plan-state plan-complete" : "plan-state"}>{state === "completed" ? "已本地执行" : "尚未执行"}</span>
          </header>
          <div className="join-tree">
            {proposal.plan.joins.map((join, index) => (
              <div key={`${join.rightSourceIndex}-${index}`}>
                <span>{columnLabel(group, join.leftSourceIndex, join.leftColumn)}</span>
                <strong>{join.type === "left" ? "左关联 =" : "内关联 ="}</strong>
                <span>{columnLabel(group, join.rightSourceIndex, join.rightColumn)}</span>
              </div>
            ))}
          </div>
          <div className="plan-grid">
            <div><small>维度</small><strong>{proposal.plan.dimensions.map((item) => columnLabel(group, item.sourceIndex, item.column)).join("、") || "无"}</strong></div>
            <div><small>计算</small><strong>{proposal.plan.measures.map((item) => `${item.operation}（${item.column === null ? "全部行" : columnLabel(group, item.sourceIndex, item.column)}）`).join("、") || "关联明细"}</strong></div>
            <div><small>筛选</small><strong>{proposal.plan.filters.map((item) => `${columnLabel(group, item.sourceIndex, item.column)} ${item.operator}${"value" in item ? ` ${item.value}` : ""}`).join("；") || "无"}</strong></div>
            <div><small>最多返回</small><strong>{proposal.plan.limit} 行</strong></div>
          </div>
          <details className="disclosure-preview">
            <summary>查看所有发送给模型的结构与合成示例</summary>
            <p>成员显示名称只在本地帮助你阅读。模型收到的是按 1–{proposal.disclosedContexts.length} 编号的列结构、合成示例，以及 {proposal.disclosedRelationships.length} 条已保存且当前有效的列关系；不含文件名、预览行或画像值。</p>
            {proposal.disclosedContexts.map((context, sourceIndex) => (
              <section className="group-disclosure-source" key={context.datasetId}>
                <h5>{sourceIndex + 1}. {sourceLabel(group, sourceIndex)}</h5>
                <div className="table-scroll disclosure-table">
                  <table>
                    <thead><tr>{context.columns.map((column) => <th key={column.name}>{column.name}<small>{column.type}</small></th>)}</tr></thead>
                    <tbody>{context.syntheticRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={context.columns[columnIndex]?.name ?? columnIndex}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </section>
            ))}
          </details>
          {state !== "completed" && <div className="plan-actions">
            <button type="button" className="primary-action" onClick={() => void execute()} disabled={state === "executing"}>{state === "executing" ? "正在本地关联…" : "批准并在本地关联"}</button>
            <button type="button" className="secondary-action" onClick={() => { setProposal(undefined); setState("draft"); }} disabled={state === "executing"}>放弃计划</button>
          </div>}
        </article>
      )}

      {result && <>
      <article className="query-result chat-result-preview">
        <header className="preview-header"><div><small>本地结果预览</small><h3>关联结果</h3></div><span>{result.rows.length} 行{result.truncated ? " · 已截断" : ""}</span></header>
        <div className="table-scroll"><table>
          <thead><tr>{result.columns.map((column) => <th key={column.label}>{resultLabel(group, column.label)}<small>{column.type}</small></th>)}</tr></thead>
          <tbody>{result.rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={result.columns[columnIndex]?.label ?? columnIndex}>{cell === null ? <span className="null-value">—</span> : String(cell)}</td>)}</tr>)}</tbody>
        </table></div>
        {result.rows.length === 0 && <p className="empty-copy">这个关联计划没有找到匹配的数据。</p>}
      </article>
      <ResultVisualization result={result} title={proposal?.plan.purpose ?? submittedQuestion ?? "群组查询结果"} />
      <ChatAssistantMessage title="关联结果已准备好"><p>关联计划已在本地执行。完整数据、图表、计划与审计证据都在结果区。</p></ChatAssistantMessage>
      </>}

      {result && proposal && threadId && <AggregateExplanationPanel plan={proposal.plan} threadId={threadId} />}
      {result && proposal && threadId && <AggregateAgentPanel plan={proposal.plan} threadId={threadId} />}

      <form className="analysis-composer" onSubmit={(event) => { event.preventDefault(); void propose(); }}>
        {!threadId && <div className="composer-thread-note"><span>先创建一个群组任务，再生成关联计划。</span><button type="button" onClick={() => void onCreateThread()}>开始群组分析</button></div>}
        <details className="composer-trust"><summary><ShieldCheck size={13} />当前上下文：结构、合成示例与有效关系</summary><p>你的问题文本会原样发送给当前模型；请不要粘贴敏感原始行或值。群组数据只自动发送结构、合成示例和有效关系。</p></details>
        <label className="sr-only" htmlFor={`group-question-${group.id}`}>向数据群组提问</label>
        <textarea id={`group-question-${group.id}`} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="例如：用第 1 个表的 Product ID 左关联第 2 个表，按类别统计订单数" maxLength={20_000} rows={2} disabled={!threadId} />
        <button type="submit" disabled={!threadId || state === "planning" || state === "executing" || question.trim().length === 0}>{state === "planning" ? "生成中…" : "先生成关联计划"}</button>
        {operationId && <button type="button" className="secondary-action" onClick={() => void cancelOperation()}>取消</button>}
      </form>
    </section>
  );
}
