import { useEffect, useState } from "react";
import type { ModelAuditEvent } from "../shared/product-api.js";
import { operationErrorMessage } from "./operation.js";

const statusLabel: Readonly<Record<ModelAuditEvent["status"], string>> = {
  started: "发送中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const purposeLabel: Readonly<Record<ModelAuditEvent["purpose"], string>> = {
  "provider-connection-test": "连接测试",
  "query-plan": "单表计划",
  "group-query-plan": "主题计划",
  "aggregate-explanation": "聚合结果解释",
  "aggregate-agent": "受限聚合 Agent",
  "explicit-row-explanation": "显式原始行解释",
  "knowledge-answer": "本地知识问答",
  "mcp-prompt-response": "MCP 提示响应",
  "mcp-tool-proposal": "MCP 工具建议",
};

export function PrivacyLedgerPanel({ refreshKey }: { readonly refreshKey: number }) {
  const [events, setEvents] = useState<readonly ModelAuditEvent[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void window.bubu.privacy.listModelAudits()
      .then((value) => {
        if (active) {
          setEvents(value);
          setError(undefined);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(operationErrorMessage(reason, "读取隐私账本失败"));
      });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <section className="privacy-ledger-panel">
      <header className="settings-section-header">
        <div><p className="hero-kicker">本地披露账本</p><h3>模型隐私账本</h3></div>
        <small>最近 {events.length} 条</small>
      </header>
      <p className="settings-copy">账本只记录披露等级、行列计数、端点 origin、用量和请求指纹；即使是显式行披露，也不在账本保存问题、Prompt、密钥、模型正文或单元格值。</p>
      {error && <div className="notice" role="status">{error}</div>}
      {events.length === 0 && !error && <p className="empty-copy">尚无模型请求。第一次连接测试或数据分析前会先写入本地审计。</p>}
      <div className="privacy-ledger-list">
        {events.map((event) => (
          <article className="privacy-ledger-row" key={event.id}>
            <div>
              <strong>{purposeLabel[event.purpose]} · {statusLabel[event.status]}</strong>
              <small>{event.providerName} / {event.model} · {event.endpointOrigin}</small>
            </div>
            <div className="privacy-ledger-metrics">
              <small>{event.disclosure} · {event.datasetCount} 个数据对象 · {event.columnCount} 列 · {event.syntheticRowCount} 合成行 · {event.aggregateRowCount} 聚合行 · {event.rawRowCount} 显式原始行 · {event.retrievedChunkCount} 个知识段落</small>
              <small>估算 {event.estimatedInputTokens} tokens · 实际 {event.totalTokens ?? "—"} · {event.payloadBytes} bytes</small>
              <small>{new Date(event.startedAt).toLocaleString("zh-CN")} · SHA-256 {event.payloadSha256.slice(0, 12)}…</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
