import type { AggregateAgentRun, AggregateExplanation } from "../shared/product-api.js";
import { AggregateExplanationCard } from "./AggregateExplanationCard.js";

function observationLabel(turn: AggregateAgentRun["turns"][number]): string {
  if (turn.action === "finish") return "生成有证据引用的最终报告";
  const observation = turn.observation;
  if (observation.name === "rank") {
    return `排序第 ${observation.input.columnIndex + 1} 列，返回 ${observation.output.ranked.length} 个引用`;
  }
  if (observation.name === "compare") {
    const { left, right } = observation.output;
    return `比较 R${left.rowIndex + 1}/C${left.columnIndex + 1} 与 R${right.rowIndex + 1}/C${right.columnIndex + 1}，差值 ${observation.output.difference}`;
  }
  return `汇总第 ${observation.input.columnIndex + 1} 列的 ${observation.output.count} 个数值`;
}

export function AggregateAgentCard({ run }: { readonly run: AggregateAgentRun }) {
  const explanation: AggregateExplanation = { ...run.report, disclosure: run.disclosure };
  return <section className="aggregate-agent-card" aria-label="受限聚合 Agent 报告">
    <AggregateExplanationCard
      explanation={explanation}
      kicker="BOUNDED AGENT REPORT"
      title="受限 Agent 分析"
      metric={`${run.turns.length} 回合 · ${run.turns.filter(({ action }) => action === "tool").length} 次本地工具`}
    />
    <details className="agent-trace">
      <summary>查看本地工具与隐私账本轨迹</summary>
      <p>这里没有隐藏思维链；只保留结构化动作、确定性观察和对应的本地审计 ID。</p>
      {run.turns.map((turn) => <div key={turn.auditId}>
        <strong>第 {turn.turn} 回合 · {turn.action === "finish" ? "完成" : turn.observation.name}</strong>
        <span>{observationLabel(turn)}</span>
        <code>{turn.auditId}</code>
      </div>)}
    </details>
  </section>;
}
