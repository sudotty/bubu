import type { ReactNode } from "react";
import type { AggregateExplanationProposal } from "../shared/product-api.js";

type DisclosurePreview = Pick<
  AggregateExplanationProposal,
  "destination" | "disclosure" | "expiresAt"
>;

export function AggregateDisclosurePreview({
  proposal,
  children,
}: {
  readonly proposal: DisclosurePreview;
  readonly children: ReactNode;
}) {
  return <article className="aggregate-disclosure-review">
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
    {children}
  </article>;
}
