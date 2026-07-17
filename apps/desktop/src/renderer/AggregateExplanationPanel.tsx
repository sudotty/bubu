import { useState } from "react";
import type {
  AggregateExplanation,
  AggregateExplanationProposal,
  OperationId,
  SafeGroupQueryPlan,
  SafeQueryPlan,
} from "../shared/product-api.js";
import { createOperationId, operationErrorMessage } from "./operation.js";
import { AggregateExplanationCard } from "./AggregateExplanationCard.js";

export function AggregateExplanationPanel({
  plan,
}: {
  readonly plan: SafeQueryPlan | SafeGroupQueryPlan;
}) {
  const [proposal, setProposal] = useState<AggregateExplanationProposal>();
  const [explanation, setExplanation] = useState<AggregateExplanation>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [notice, setNotice] = useState<string>();

  async function prepare(): Promise<void> {
    setNotice(undefined);
    setExplanation(undefined);
    try {
      setProposal(await window.bubu.analysis.prepareAggregateExplanation({ plan }));
    } catch (error) {
      setNotice(operationErrorMessage(error, "这个结果不符合安全聚合披露条件"));
    }
  }

  async function approve(): Promise<void> {
    if (!proposal) return;
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    setNotice(undefined);
    try {
      const result = await window.bubu.analysis.approveAggregateExplanation(
        { approvalToken: proposal.approvalToken },
        nextOperationId,
      );
      setExplanation(result);
      setProposal(undefined);
      setNotice("模型只分析了你刚才批准的聚合内容，解释已写入本地对话。");
    } catch (error) {
      setProposal(undefined);
      setNotice(operationErrorMessage(error, "聚合结果解释失败，请重新审查后再试"));
    } finally {
      setOperationId(undefined);
    }
  }

  async function dismiss(): Promise<void> {
    if (!proposal) return;
    try {
      await window.bubu.analysis.dismissAggregateExplanation({ approvalToken: proposal.approvalToken });
      setProposal(undefined);
      setNotice("已撤销这次披露批准。没有调用模型。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "撤销失败，请重试"));
    }
  }

  return (
    <section className="aggregate-explanation-panel" aria-label="AI 聚合结果解释">
      <header><div><p className="hero-kicker">EXPLICIT AGGREGATE DISCLOSURE</p><h3>让 AI 解读聚合结果</h3></div>{!proposal && !operationId && <button type="button" className="secondary-action" onClick={() => void prepare()}>检查并预览发送内容</button>}</header>
      <p className="settings-copy">只有包含 COUNT(*)、每组至少 5 条、没有最小值/最大值且最多 50 行的聚合结果可以进入这个流程。原始明细仍留在本地。</p>
      {notice && <div className="notice" role="status">{notice}</div>}
      {proposal && <article className="aggregate-disclosure-review">
        <header><div><strong>发送前逐项审查</strong><small>{proposal.destination.providerName} / {proposal.destination.model}</small></div><span>{proposal.disclosure.rows.length} 行 · {proposal.disclosure.columns.length} 列</span></header>
        <p>目标端点：<code>{proposal.destination.endpointOrigin}</code>。下表全部内容、你的问题和结果用途将发送给该模型；表外数据不会发送。批准在 {new Date(proposal.expiresAt).toLocaleTimeString("zh-CN")} 失效。</p>
        <dl className="aggregate-disclosure-context">
          <div><dt>发送的问题</dt><dd>{proposal.disclosure.question}</dd></div>
          <div><dt>结果用途</dt><dd>{proposal.disclosure.purpose}</dd></div>
        </dl>
        <div className="table-scroll"><table>
          <thead><tr><th>引用</th>{proposal.disclosure.columns.map((column) => <th key={column.label}>{column.label}<small>{column.type}</small></th>)}</tr></thead>
          <tbody>{proposal.disclosure.rows.map((row, rowIndex) => <tr key={rowIndex}><th>R{rowIndex + 1}</th>{row.map((cell, columnIndex) => <td key={proposal.disclosure.columns[columnIndex]?.label ?? columnIndex}>{cell === null ? "—" : String(cell)}</td>)}</tr>)}</tbody>
        </table></div>
        <div className="plan-actions">
          <button type="button" className="primary-action" onClick={() => void approve()}>批准发送这些聚合内容</button>
          <button type="button" className="secondary-action" onClick={() => void dismiss()}>放弃且撤销</button>
        </div>
      </article>}
      {operationId && <div className="analysis-progress">正在分析已批准的聚合内容… <button type="button" className="secondary-action" onClick={() => void window.bubu.operations.cancel(operationId)}>取消</button></div>}
      {explanation && <AggregateExplanationCard explanation={explanation} />}
    </section>
  );
}
