import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type {
  QueryPlanProposal,
  SafeQueryResult,
  OperationId,
  DatasetPreview,
  DatasetSummary,
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
import { ExplicitRowDisclosurePanel } from "./ExplicitRowDisclosurePanel.js";

function messageFrom(error: unknown): string {
  return operationErrorMessage(error, "数据分析失败，请重试");
}

function measureLabel(measure: QueryPlanProposal["plan"]["measures"][number]): string {
  const operations = {
    count: "计数",
    sum: "求和",
    average: "平均值",
    minimum: "最小值",
    maximum: "最大值",
  } as const;
  return `${operations[measure.operation]}${measure.column === null ? "（全部行）" : `（${measure.column}）`}`;
}

function filterLabel(filter: QueryPlanProposal["plan"]["filters"][number]): string {
  const operators = {
    equals: "等于",
    "not-equals": "不等于",
    contains: "包含",
    "greater-than": "大于",
    "greater-or-equal": "大于等于",
    "less-than": "小于",
    "less-or-equal": "小于等于",
    "is-null": "为空",
    "is-not-null": "不为空",
  } as const;
  return "value" in filter
    ? `${filter.column} ${operators[filter.operator]} ${filter.value}`
    : `${filter.column} ${operators[filter.operator]}`;
}

export function DatasetAnalysis({ dataset, preview, threadId, onCreateThread, onOpenArtifact }: { readonly dataset: DatasetSummary; readonly preview: DatasetPreview | undefined; readonly threadId?: string | undefined; readonly onCreateThread: () => Promise<void>; readonly onOpenArtifact: () => void }) {
  const datasetId = dataset.id;
  const datasetName = dataset.displayName;
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string>();
  const [proposal, setProposal] = useState<QueryPlanProposal>();
  const [result, setResult] = useState<SafeQueryResult>();
  const [state, setState] = useState<TaskLifecycleState>("draft");
  const [error, setError] = useState<string>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [startedAt, setStartedAt] = useState<number>();
  const [completedAt, setCompletedAt] = useState<number>();
  const history = useConversationThread({ kind: "dataset", id: datasetId }, threadId);

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
  }, [datasetId, threadId]);

  useEffect(() => {
    if (!history || !threadId || operationId || submittedQuestion) return;
    const snapshot = latestTaskSnapshot(history.entries);
    const persistedProposal = snapshot.plan?.payload.proposal;
    setProposal(persistedProposal && "disclosedContext" in persistedProposal ? persistedProposal : undefined);
    setResult(snapshot.result && "datasetId" in snapshot.result.payload.result ? snapshot.result.payload.result : undefined);
    setError(snapshot.error && (!snapshot.result || snapshot.error.ordinal > snapshot.result.ordinal) ? snapshot.error.payload.message : undefined);
    setState(derivePersistedTaskState(snapshot.entries));
  }, [history, operationId, submittedQuestion, threadId]);

  async function propose(questionOverride?: string): Promise<void> {
    const normalizedQuestion = (questionOverride ?? question).trim();
    if (!normalizedQuestion) return;
    setQuestion("");
    setSubmittedQuestion(normalizedQuestion);
    setProposal(undefined);
    setResult(undefined);
    setError(undefined);
    setState("planning");
    const nextStartedAt = Date.now();
    setStartedAt(nextStartedAt);
    recordProductMetric({ name: "task_question_submitted", targetKind: "dataset", outcome: "started" });
    setCompletedAt(undefined);
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    try {
      const next = await window.bubu.analysis.propose(
        { datasetId, threadId, question: normalizedQuestion, promptTemplate: currentPromptTemplate("dataset-query") },
        nextOperationId,
      );
      setProposal(next);
      setState("awaiting-approval");
      recordProductMetric({ name: "task_plan_ready", targetKind: "dataset", outcome: "succeeded", durationMs: Math.max(0, Date.now() - nextStartedAt) });
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
    setState("executing");
    recordProductMetric({ name: "task_plan_approved", targetKind: "dataset", outcome: "started" });
    setError(undefined);
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    try {
      if (!threadId) throw new Error("请先创建或选择一个对话任务");
      const nextResult = await window.bubu.analysis.execute({ plan: proposal.plan, threadId }, nextOperationId);
      setResult(nextResult);
      setState("completed");
      setCompletedAt(Date.now());
      recordProductMetric({ name: "task_result_ready", targetKind: "dataset", outcome: "succeeded", rowCount: nextResult.rows.length, columnCount: nextResult.columns.length });
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
    <section className="analysis-panel" aria-label={`与 ${datasetName} 对话`}>
      <header className="analysis-header">
        <div>
          <p className="chat-context-label">私密数据对话</p>
          <h3>和「{datasetName}」对话</h3>
        </div>
        <span className="mode-pill">计划批准后才查询</span>
      </header>
      {preview && <details className="explicit-row-entry"><summary>需要让模型解释特定原始行？</summary><ExplicitRowDisclosurePanel dataset={dataset} preview={preview} /></details>}
      <TaskRunStatus state={state} startedAt={startedAt} completedAt={completedAt} />

      <ConversationHistory thread={history} hideQuestion={submittedQuestion} hideLatestPlan={proposal !== undefined} hideLatestResult={result !== undefined} />

      {submittedQuestion && (
        <ChatUserMessage><p>{submittedQuestion}</p></ChatUserMessage>
      )}
      {state === "planning" && <ChatToolEvent busy>正在用结构和合成示例生成受限查询计划…</ChatToolEvent>}
      {state === "cancelled" && <ChatAssistantMessage title="当前操作已取消"><p>已保存的任务记录没有变化。你可以修改问题，或直接重新生成计划。</p></ChatAssistantMessage>}
      {state === "needs-attention" && <ChatRecoveryMessage message={error ?? "上次运行在生成计划前中断，任务记录已保留。"} actions={<><button type="button" className="primary-action" onClick={() => { recordProductMetric({ name: "task_recovery_selected", targetKind: "dataset", outcome: "started" }); void propose(recoverableQuestion); }} disabled={!recoverableQuestion}>重新生成计划</button><button type="button" className="secondary-action" onClick={() => { recordProductMetric({ name: "task_recovery_selected", targetKind: "dataset", outcome: "started" }); editRecoverableQuestion(); }}>修改问题</button></>} />}

      {proposal && (
        <article className="plan-card chat-approval-card">
          <header>
            <div>
              <p className="chat-context-label">{state === "completed" ? "本次执行计划" : state === "executing" ? "正在执行计划" : "需要你的批准"}</p>
              <h4>{proposal.plan.purpose}</h4>
            </div>
            <span className={state === "completed" ? "plan-state plan-complete" : "plan-state"}>
              {state === "completed" ? "已本地执行" : "尚未执行"}
            </span>
          </header>
          <div className="plan-grid">
            <div><small>维度</small><strong>{proposal.plan.dimensions.join("、") || "无"}</strong></div>
            <div><small>计算</small><strong>{proposal.plan.measures.map(measureLabel).join("、") || "明细行"}</strong></div>
            <div><small>筛选</small><strong>{proposal.plan.filters.map(filterLabel).join("；") || "无"}</strong></div>
            <div><small>最多返回</small><strong>{proposal.plan.limit} 行</strong></div>
          </div>
          {proposal.promptTemplate && <p className="plan-template-note">分析模板 · <strong>{proposal.promptTemplate.name}</strong><span>{proposal.promptTemplate.description}</span></p>}
          <details className="disclosure-preview">
            <summary>查看本次发送给模型的完整内容边界</summary>
            <p>仅发送你的问题、{proposal.disclosedContext.columns.length} 个列名/类型和 3 行本地生成的合成示例；没有发送预览行、画像值、文件名或路径。</p>
            <div className="table-scroll disclosure-table">
              <table>
                <thead><tr>{proposal.disclosedContext.columns.map((column) => <th key={column.name}>{column.name}<small>{column.type}</small></th>)}</tr></thead>
                <tbody>{proposal.disclosedContext.syntheticRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={proposal.disclosedContext.columns[columnIndex]?.name ?? columnIndex}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </details>
          {state !== "completed" && (
            <div className="plan-actions">
              <button type="button" className="primary-action" onClick={() => void execute()} disabled={state === "executing"}>
                {state === "executing" ? "正在本地查询…" : "批准并在本地执行"}
              </button>
              <button type="button" className="secondary-action" onClick={() => { setProposal(undefined); setState("draft"); }} disabled={state === "executing"}>放弃计划</button>
            </div>
          )}
        </article>
      )}

      {result && (
        <>
        <article className="query-result chat-result-preview">
          <header className="preview-header">
            <div><small>本地结果预览</small><h3>结果</h3></div>
            <span>{result.rows.length} 行{result.truncated ? " · 已按计划截断" : ""}</span>
          </header>
          <div className="table-scroll">
            <table>
              <thead><tr>{result.columns.map((column) => <th key={column.label}>{column.label}<small>{resultTypeLabel(column.type)}</small></th>)}</tr></thead>
              <tbody>
                {result.rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={result.columns[columnIndex]?.label ?? columnIndex}>{cell === null ? <span className="null-value">—</span> : String(cell)}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          {result.rows.length === 0 && <p className="empty-copy">这个计划没有找到匹配的数据。</p>}
        </article>
        <ResultVisualization result={result} title={proposal?.plan.purpose ?? submittedQuestion ?? "查询结果"} />
        <ChatAssistantMessage title="结果已准备好"><p>我已在本地执行经过审查的计划。完整数据、图表、计划与审计证据都在结果区。</p><ChatResultFile title={proposal?.plan.purpose ?? submittedQuestion ?? "查询结果"} result={result} /><button type="button" className="chat-artifact-link" onClick={onOpenArtifact}>打开结果区</button></ChatAssistantMessage>
        </>
      )}

      {result && proposal && threadId && <ResultFollowups plan={proposal.plan} threadId={threadId} />}

      <form className="analysis-composer" onSubmit={(event) => { event.preventDefault(); void propose(); }}>
        {!threadId && <div id={`question-${datasetId}-status`} className="composer-thread-note"><span>先创建一个独立任务，再提出问题。</span><button type="button" onClick={() => void onCreateThread()}>开始新任务</button></div>}
        {threadId && state === "draft" && !submittedQuestion && !proposal && !result && question.length === 0 && (history?.entries.length ?? 0) === 0 && <TaskStarters kind="dataset" onSelect={(value) => { setQuestion(value); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`#question-${datasetId}`)?.focus()); }} />}
        {threadId && <PromptTemplateSelector scope="dataset-query" />}
        <div className="composer-trust" role="note"><span><ShieldCheck size={13} />仅自动使用列结构与合成示例</span><small>问题文本会原样发送给当前模型，请勿粘贴敏感原始值。</small></div>
        <label className="sr-only" htmlFor={`question-${datasetId}`}>向这个数据对象提问</label>
        <textarea
          id={`question-${datasetId}`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
          placeholder="例如：按区域统计已支付订单的金额，并按金额从高到低排序"
          maxLength={20_000}
          rows={2}
          disabled={!threadId}
          aria-describedby={`question-${datasetId}-hint${!threadId ? ` question-${datasetId}-status` : ""}`}
        />
        <button type="submit" disabled={!threadId || state === "planning" || state === "executing" || question.trim().length === 0}>
          {state === "planning" ? "生成中…" : "先生成计划"}
        </button>
        {operationId && <button type="button" className="secondary-action" onClick={() => void cancelOperation()}>取消</button>}
        <small id={`question-${datasetId}-hint`} className="composer-keyboard-hint">Enter 发送 · Shift+Enter 换行</small>
      </form>
    </section>
  );
}
