import type { ConversationThread, DatasetGroup } from "../shared/product-api.js";
import { AggregateExplanationCard } from "./AggregateExplanationCard.js";
import { AggregateAgentCard } from "./AggregateAgentCard.js";
import { ChatAssistantMessage, ChatRecoveryMessage, ChatUserMessage } from "./ChatMessage.js";

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
  hideLatestResult,
}: {
  readonly thread: ConversationThread | null | undefined;
  readonly group?: DatasetGroup;
  readonly hideQuestion?: string | undefined;
  readonly hideLatestResult?: boolean;
}) {
  if (!thread || thread.entries.length === 0) return null;
  return (
    <section className="conversation-history" aria-label="本地历史对话">
      <header className="history-divider"><span>之前的消息</span><small>{thread.entries.length} 条本地记录</small></header>
      {thread.entries.map((entry) => {
        if (entry.kind === "question") {
          if (hideQuestion === entry.payload.question) return null;
          return <ChatUserMessage historical key={entry.id}><p>{entry.payload.question}</p></ChatUserMessage>;
        }
        if (entry.kind === "plan") {
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
          if ("explanation" in entry.payload) {
            return <AggregateExplanationCard key={entry.id} explanation={entry.payload.explanation} />;
          }
          return <AggregateAgentCard key={entry.id} run={entry.payload.agentRun} />;
        }
        const result = entry.payload.result;
        if (hideLatestResult && entry.id === thread.entries.findLast(({ kind }) => kind === "result")?.id) return null;
        return <div className="history-result chat-result-preview" key={entry.id}>
          <header className="preview-header"><div><small>本地结果</small><h3>历史结果</h3></div><span>{result.rows.length} 行{result.truncated ? " · 已截断" : ""}</span></header>
          <div className="table-scroll"><table>
            <thead><tr>{result.columns.map((column) => <th key={column.label}>{localResultLabel(group, column.label)}<small>{column.type}</small></th>)}</tr></thead>
            <tbody>{result.rows.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={result.columns[columnIndex]?.label ?? columnIndex}>{cell === null ? <span className="null-value">—</span> : String(cell)}</td>)}</tr>)}</tbody>
          </table></div>
          <ChatAssistantMessage title="结果仍可继续使用"><p>完整数据、图表、计划与审计证据保存在结果区。</p></ChatAssistantMessage>
        </div>;
      })}
    </section>
  );
}
