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
import { ResultFollowups } from "./ResultFollowups.js";
import { TaskStarters } from "./TaskStarters.js";
import { PromptTemplateSelector } from "./PromptTemplateSelector.js";
import { currentPromptTemplate } from "./prompt-template-preferences.js";
import { TaskRunStatus } from "./TaskRunStatus.js";
import { ChatAssistantMessage, ChatRecoveryMessage, ChatResultFile, ChatToolEvent, ChatUserMessage } from "./ChatMessage.js";
import { derivePersistedTaskState, isCancellation, latestTaskSnapshot, type TaskLifecycleState } from "./task-lifecycle.js";
import { recordProductMetric } from "./product-metrics.js";
import { resultTypeLabel } from "./result-type-label.js";

function messageFrom(error: unknown): string {
  return operationErrorMessage(error, "业务主题分析失败，请重试");
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

export function DatasetGroupAnalysis({ group, threadId, onCreateThread, onOpenArtifact }: { readonly group: DatasetGroup; readonly threadId?: string | undefined; readonly onCreateThread: () => Promise<void>; readonly onOpenArtifact: () => void }) {
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
    const snapshot = latestTaskSnapshot(history.entries);
    const persistedProposal = snapshot.plan?.payload.proposal;
    setProposal(persistedProposal && "disclosedContexts" in persistedProposal ? persistedProposal : undefined);
    setResult(snapshot.result && "groupId" in snapshot.result.payload.result ? snapshot.result.payload.result : undefined);
    setError(snapshot.error && (!snapshot.result || snapshot.error.ordinal > snapshot.result.ordinal) ? snapshot.error.payload.message : undefined);
    setState(derivePersistedTaskState(snapshot.entries));
  }, [history, operationId, submittedQuestion, threadId]);

  async function propose(questionOverride?: string): Promise<void> {
    const normalized = (questionOverride ?? question).trim();
    if (!normalized) return;
    setQuestion("");
    setSubmittedQuestion(normalized);
    setProposal(undefined);
    setResult(undefined);
    setError(undefined);
    setState("planning");
    setStartedAt(Date.now());
    recordProductMetric({ name: "task_question_submitted", targetKind: "group", outcome: "started" });
    setCompletedAt(undefined);
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    try {
      setProposal(await window.bubu.analysis.proposeGroup(
        { groupId: group.id, threadId, question: normalized, promptTemplate: currentPromptTemplate("group-query") },
        nextOperationId,
      ));
      setState("awaiting-approval");
      recordProductMetric({ name: "task_plan_ready", targetKind: "group", outcome: "succeeded" });
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
    recordProductMetric({ name: "task_plan_approved", targetKind: "group", outcome: "started" });
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    try {
      if (!threadId) throw new Error("请先创建或选择一个对话任务");
      const nextResult = await window.bubu.analysis.executeGroup({ plan: proposal.plan, threadId }, nextOperationId);
      setResult(nextResult);
      setState("completed");
      setCompletedAt(Date.now());
      recordProductMetric({ name: "task_result_ready", targetKind: "group", outcome: "succeeded", rowCount: nextResult.rows.length, columnCount: nextResult.columns.length });
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

  const lastQuestion = history ? latestTaskSnapshot(history.entries).question : undefined;
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
    <section className="analysis-panel group-analysis" aria-label={`与业务主题 ${group.name} 对话`}>
      <header className="analysis-header">
        <div><p className="chat-context-label">私密多表对话</p><h3>分析业务主题「{group.name}」</h3></div>
        <span className="mode-pill">仅使用已确认关系进行安全关联</span>
      </header>
      <TaskRunStatus state={state} startedAt={startedAt} completedAt={completedAt} />
      <ConversationHistory thread={history} group={group} hideQuestion={submittedQuestion} hideLatestPlan={proposal !== undefined} hideLatestResult={result !== undefined} />
      <div className="group-source-order">
        {group.members.map((member, index) => <span key={member.id}><strong>{index + 1}</strong>{member.displayName}</span>)}
      </div>
      {submittedQuestion && <ChatUserMessage><p>{submittedQuestion}</p></ChatUserMessage>}
      {state === "planning" && <ChatToolEvent busy>正在根据每个成员的结构和合成示例生成关联树…</ChatToolEvent>}
      {state === "cancelled" && <ChatAssistantMessage title="当前操作已取消"><p>主题关系与已保存的任务记录没有变化。你可以修改问题，或重新生成关联计划。</p></ChatAssistantMessage>}
      {state === "needs-attention" && <ChatRecoveryMessage message={error ?? "上次运行在生成关联计划前中断，主题任务记录已保留。"} actions={<><button type="button" className="primary-action" onClick={() => void propose(recoverableQuestion)} disabled={!recoverableQuestion}>重新生成关联计划</button><button type="button" className="secondary-action" onClick={editRecoverableQuestion}>修改问题</button></>} />}

      {proposal && (
        <article className="plan-card chat-approval-card">
          <header>
            <div><p className="chat-context-label">{state === "completed" ? "本次执行计划" : state === "executing" ? "正在执行计划" : "需要你的批准"}</p><h4>{proposal.plan.purpose}</h4></div>
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
          {proposal.promptTemplate && <p className="plan-template-note">分析模板 · <strong>{proposal.promptTemplate.name}</strong><span>{proposal.promptTemplate.description}</span></p>}
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
          <thead><tr>{result.columns.map((column) => <th key={column.label}>{resultLabel(group, column.label)}<small>{resultTypeLabel(column.type)}</small></th>)}</tr></thead>
          <tbody>{result.rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={result.columns[columnIndex]?.label ?? columnIndex}>{cell === null ? <span className="null-value">—</span> : String(cell)}</td>)}</tr>)}</tbody>
        </table></div>
        {result.rows.length === 0 && <p className="empty-copy">这个关联计划没有找到匹配的数据。</p>}
      </article>
      <ResultVisualization result={result} title={proposal?.plan.purpose ?? submittedQuestion ?? "主题查询结果"} />
      <ChatAssistantMessage title="关联结果已准备好"><p>关联计划已在本地执行。完整数据、图表、计划与审计证据都在结果区。</p><ChatResultFile title={proposal?.plan.purpose ?? submittedQuestion ?? "主题查询结果"} result={result} /><button type="button" className="chat-artifact-link" onClick={onOpenArtifact}>打开结果区</button></ChatAssistantMessage>
      </>}

      {result && proposal && threadId && <ResultFollowups plan={proposal.plan} threadId={threadId} />}

      <form className="analysis-composer" onSubmit={(event) => { event.preventDefault(); void propose(); }}>
        {!threadId && <div id={`group-question-${group.id}-status`} className="composer-thread-note"><span>先创建一个主题任务，再生成关联计划。</span><button type="button" onClick={() => void onCreateThread()}>开始主题分析</button></div>}
        {threadId && state === "draft" && !submittedQuestion && !proposal && !result && question.length === 0 && (history?.entries.length ?? 0) === 0 && <TaskStarters kind="group" onSelect={(value) => { setQuestion(value); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`#group-question-${group.id}`)?.focus()); }} />}
        {threadId && <PromptTemplateSelector scope="group-query" />}
        <div className="composer-trust" role="note"><span><ShieldCheck size={13} />仅自动使用结构、合成示例与有效关系</span><small>问题文本会原样发送给当前模型，请勿粘贴敏感原始值。</small></div>
        <label className="sr-only" htmlFor={`group-question-${group.id}`}>向业务主题提问</label>
        <textarea id={`group-question-${group.id}`} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="例如：用第 1 个表的 Product ID 左关联第 2 个表，按类别统计订单数" maxLength={20_000} rows={2} disabled={!threadId} aria-describedby={`group-question-${group.id}-hint${!threadId ? ` group-question-${group.id}-status` : ""}`} />
        <button type="submit" disabled={!threadId || state === "planning" || state === "executing" || question.trim().length === 0}>{state === "planning" ? "生成中…" : "先生成关联计划"}</button>
        {operationId && <button type="button" className="secondary-action" onClick={() => void cancelOperation()}>取消</button>}
        <small id={`group-question-${group.id}-hint`} className="composer-keyboard-hint">Enter 发送 · Shift+Enter 换行</small>
      </form>
    </section>
  );
}
