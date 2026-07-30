import { useEffect, useMemo, useState } from "react";
import type { ConversationEntry, ConversationThread, DatasetGroup } from "../shared/product-api.js";
import { AggregateExplanationCard } from "./AggregateExplanationCard.js";
import { AggregateAgentCard } from "./AggregateAgentCard.js";
import { ChatAssistantMessage, ChatRecoveryMessage, ChatResultFile, ChatUserMessage } from "./ChatMessage.js";
import { resultTypeLabel } from "./result-type-label.js";

function localResultLabel(group: DatasetGroup | undefined, label: string): string {
  if (!group) return label;
  return label.replace(/^Source (\d+) · /u, (_match, rawIndex: string) => {
    const member = group.members[Number(rawIndex) - 1];
    return member ? `${member.displayName} · ` : `数据源 ${rawIndex} · `;
  });
}

export function ConversationHistory({
  thread,
  group,
  hideQuestion,
  hideLatestPlan,
  hideLatestResult,
}: {
  readonly thread: ConversationThread | null | undefined;
  readonly group?: DatasetGroup;
  readonly hideQuestion?: string | undefined;
  readonly hideLatestPlan?: boolean;
  readonly hideLatestResult?: boolean;
}) {
  const [loadedThreadId, setLoadedThreadId] = useState<string | null>(null);
  const [earlierEntries, setEarlierEntries] = useState<readonly ConversationEntry[]>([]);
  const [nextBeforeOrdinal, setNextBeforeOrdinal] = useState<number | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  useEffect(() => {
    setLoadedThreadId(thread?.id ?? null);
    setEarlierEntries([]);
    setNextBeforeOrdinal(null);
    setLoadingEarlier(false);
    setPageError(null);
  }, [thread?.id]);
  const loadedEntries = loadedThreadId === thread?.id ? earlierEntries : [];
  const entries = useMemo(() => {
    const byId = new Map<string, ConversationEntry>();
    for (const entry of [...loadedEntries, ...(thread?.entries ?? [])]) byId.set(entry.id, entry);
    return [...byId.values()].sort((left, right) => left.ordinal - right.ordinal);
  }, [loadedEntries, thread?.entries]);
  if (!thread || entries.length === 0) return null;
  const earliestOrdinal = entries[0]?.ordinal ?? 1;
  const hasEarlierEntries = (nextBeforeOrdinal ?? earliestOrdinal) > 1;
  const latestPlanId = entries.findLast(({ kind }) => kind === "plan")?.id;
  const latestResultId = entries.findLast(({ kind }) => kind === "result")?.id;
  const visibleEntryCount = entries.filter((entry) => {
    if (entry.kind === "question" && hideQuestion === entry.payload.question) return false;
    if (entry.kind === "plan" && hideLatestPlan && entry.id === latestPlanId) return false;
    if (entry.kind === "result" && hideLatestResult && entry.id === latestResultId) return false;
    return true;
  }).length;
  if (visibleEntryCount === 0) return null;
  return (
    <section className="conversation-history" aria-label="本地历史对话">
      <header className="history-divider"><span>之前的消息</span><small>{visibleEntryCount} 条可见记录</small></header>
      {hasEarlierEntries ? <div className="history-pagination">
        <button
          className="secondary-button"
          disabled={loadingEarlier}
          onClick={() => {
            const beforeOrdinal = nextBeforeOrdinal ?? earliestOrdinal;
            setLoadingEarlier(true);
            setPageError(null);
            void window.bubu.conversations.page({ threadId: thread.id, beforeOrdinal, limit: 100 })
              .then((page) => {
                setLoadedThreadId(thread.id);
                setEarlierEntries((current) => [...page.entries, ...current]);
                setNextBeforeOrdinal(page.nextBeforeOrdinal);
              })
              .catch((error: unknown) => setPageError(error instanceof Error ? error.message : "更早记录加载失败"))
              .finally(() => setLoadingEarlier(false));
          }}
          type="button"
        >{loadingEarlier ? "正在加载…" : "加载更早记录"}</button>
        <small>每次最多读取 100 条，本地数据不会离开设备。</small>
      </div> : null}
      {pageError ? <p className="inline-error" role="alert">{pageError}，可以重试。</p> : null}
      {entries.map((entry) => {
        if (entry.kind === "question") {
          if (hideQuestion === entry.payload.question) return null;
          return <ChatUserMessage historical key={entry.id}><p>{entry.payload.question}</p></ChatUserMessage>;
        }
        if (entry.kind === "plan") {
          if (hideLatestPlan && entry.id === latestPlanId) return null;
          return <article className="history-plan chat-approval-card" key={entry.id}>
            <span>已批准并保存</span>
            <strong>{entry.payload.proposal.plan.purpose}</strong>
            <small>结果只会在本地执行；发送上下文保存在本地审计记录中。</small>
          </article>;
        }
        if (entry.kind === "error") {
          return <ChatRecoveryMessage key={entry.id} message={entry.payload.message} actions={<small>回到这个任务后可修改问题并重试。</small>} />;
        }
        if (entry.kind === "insight") {
          if ("automation" in entry.payload) {
            const automation = entry.payload.automation;
            return <article className={`history-plan chat-approval-card is-${automation.status}`} key={entry.id}>
              <span>{automation.status === "succeeded" ? "自动重算完成" : "自动重算需处理"}</span>
              <strong>{automation.targetDisplayName}</strong>
              <p>{automation.message}</p>
              <small>任务 {automation.eventId.slice(0, 8)} · 上游版本 {automation.sourceVersionId.slice(0, 8)}{automation.resultVersionId ? ` · 结果版本 ${automation.resultVersionId.slice(0, 8)}` : ""}</small>
            </article>;
          }
          if ("explanation" in entry.payload) {
            return <AggregateExplanationCard key={entry.id} explanation={entry.payload.explanation} />;
          }
          return <AggregateAgentCard key={entry.id} run={entry.payload.agentRun} />;
        }
        const result = entry.payload.result;
        if (hideLatestResult && entry.id === latestResultId) return null;
        return <details className="history-result chat-result-preview" key={entry.id}>
          <summary><span>历史结果</span><small>{result.rows.length} 行{result.truncated ? " · 已截断" : ""}</small></summary>
          <div className="table-scroll"><table>
            <thead><tr>{result.columns.map((column) => <th key={column.label}>{localResultLabel(group, column.label)}<small>{resultTypeLabel(column.type)}</small></th>)}</tr></thead>
            <tbody>{result.rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={result.columns[columnIndex]?.label ?? columnIndex}>{cell === null ? <span className="null-value">—</span> : String(cell)}</td>)}</tr>)}</tbody>
          </table></div>
          <ChatAssistantMessage title="结果仍可继续使用"><p>完整数据、图表、计划与审计证据保存在结果区。</p><ChatResultFile title="历史查询结果" result={result} /></ChatAssistantMessage>
        </details>;
      })}
    </section>
  );
}
