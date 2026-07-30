import type { SafeGroupQueryPlan, SafeQueryPlan } from "../shared/product-api.js";
import { AggregateAgentPanel } from "./AggregateAgentPanel.js";
import { AggregateExplanationPanel } from "./AggregateExplanationPanel.js";

export function ResultFollowups({ plan, threadId }: { readonly plan: SafeQueryPlan | SafeGroupQueryPlan; readonly threadId: string }) {
  return <section className="result-followups" aria-label="可选结果后续操作">
    <header><div><p className="hero-kicker">可选下一步</p><h3>需要更深的解释吗？</h3></div><small>每次出站前都要单独预览并批准</small></header>
    <details>
      <summary><span><strong>让 AI 解读聚合结果</strong><small>适合快速总结趋势与差异</small></span><em>按需展开</em></summary>
      <AggregateExplanationPanel plan={plan} threadId={threadId} />
    </details>
    <details>
      <summary><span><strong>让受限 Agent 深挖</strong><small>固定回合、工具与时间预算</small></span><em>按需展开</em></summary>
      <AggregateAgentPanel plan={plan} threadId={threadId} />
    </details>
  </section>;
}
