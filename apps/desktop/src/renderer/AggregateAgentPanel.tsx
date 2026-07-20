import { useState } from "react";
import type {
  AggregateAgentProposal,
  AggregateAgentRun,
  OperationId,
  SafeGroupQueryPlan,
  SafeQueryPlan,
} from "../shared/product-api.js";
import { AggregateAgentCard } from "./AggregateAgentCard.js";
import { AggregateDisclosurePreview } from "./AggregateDisclosurePreview.js";
import { createOperationId, operationErrorMessage } from "./operation.js";

const toolLabels = ["聚合列排序", "两个数值单元格比较", "数值聚合列汇总"] as const;

export function AggregateAgentPanel({
  plan,
  threadId,
}: {
  readonly plan: SafeQueryPlan | SafeGroupQueryPlan;
  readonly threadId: string;
}) {
  const [goal, setGoal] = useState("");
  const [proposal, setProposal] = useState<AggregateAgentProposal>();
  const [run, setRun] = useState<AggregateAgentRun>();
  const [operationId, setOperationId] = useState<OperationId>();
  const [notice, setNotice] = useState<string>();

  async function prepare(): Promise<void> {
    const normalizedGoal = goal.trim();
    if (!normalizedGoal) return;
    setNotice(undefined);
    setRun(undefined);
    try {
      setProposal(await window.bubu.analysis.prepareAggregateAgent({ plan, threadId, goal: normalizedGoal }));
    } catch (error) {
      setNotice(operationErrorMessage(error, "这个结果不符合受限 Agent 的安全聚合条件"));
    }
  }

  async function approve(): Promise<void> {
    if (!proposal) return;
    const nextOperationId = createOperationId();
    setOperationId(nextOperationId);
    setNotice(undefined);
    try {
      const result = await window.bubu.analysis.approveAggregateAgent(
        { approvalToken: proposal.approvalToken },
        nextOperationId,
      );
      setRun(result);
      setProposal(undefined);
      setNotice("受限 Agent 已在固定预算内完成，报告和审计轨迹已写入本地对话。");
    } catch (error) {
      setProposal(undefined);
      setNotice(operationErrorMessage(error, "受限 Agent 运行失败，请重新审查后再试"));
    } finally {
      setOperationId(undefined);
    }
  }

  async function dismiss(): Promise<void> {
    if (!proposal) return;
    try {
      await window.bubu.analysis.dismissAggregateAgent({ approvalToken: proposal.approvalToken });
      setProposal(undefined);
      setNotice("已撤销 Agent 批准。没有调用模型。");
    } catch (error) {
      setNotice(operationErrorMessage(error, "撤销失败，请重试"));
    }
  }

  return <section className="aggregate-agent-panel" aria-label="受限聚合 Agent">
    <header><div><p className="hero-kicker">受限计划 · 行动 · 观察</p><h3>让受限 Agent 深挖聚合结果</h3></div></header>
    <p className="settings-copy">Agent 只能计算你逐项批准的聚合单元格；没有 SQL、文件、网络、MCP、代码、导出或写入工具，也不能查询新的本地数据。</p>
    {!proposal && !operationId && <form className="agent-goal-form" onSubmit={(event) => { event.preventDefault(); void prepare(); }}>
      <label htmlFor={`aggregate-agent-goal-${"datasetId" in plan ? plan.datasetId : plan.groupId}`}>分析目标</label>
      <textarea
        id={`aggregate-agent-goal-${"datasetId" in plan ? plan.datasetId : plan.groupId}`}
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        placeholder="例如：找出最值得关注的区域差异，用本地计算核对后给出有单元格证据的结论"
        maxLength={2_000}
        rows={2}
      />
      <button type="submit" className="secondary-action" disabled={goal.trim().length === 0}>审查 Agent 的数据与预算</button>
    </form>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {proposal && <AggregateDisclosurePreview proposal={proposal}>
      <div className="agent-budget-grid">
        <div><small>模型回合</small><strong>最多 {proposal.budget.maxTurns}</strong></div>
        <div><small>本地工具</small><strong>最多 {proposal.budget.maxToolCalls}</strong></div>
        <div><small>总时限</small><strong>{proposal.budget.maxDurationMs / 1_000} 秒</strong></div>
        <div><small>输出预算</small><strong>{proposal.budget.maxTotalOutputTokens.toLocaleString()} tokens</strong></div>
      </div>
      <div className="agent-tool-list"><small>固定只读工具</small>{toolLabels.map((label) => <span key={label}>{label}</span>)}</div>
      <div className="plan-actions">
        <button type="button" className="primary-action" onClick={() => void approve()}>批准此数据、模型与固定预算</button>
        <button type="button" className="secondary-action" onClick={() => void dismiss()}>放弃且撤销</button>
      </div>
    </AggregateDisclosurePreview>}
    {operationId && <div className="analysis-progress">Agent 正在固定预算内分析… <button type="button" className="secondary-action" onClick={() => void window.bubu.operations.cancel(operationId)}>取消</button></div>}
    {run && <AggregateAgentCard run={run} />}
  </section>;
}
