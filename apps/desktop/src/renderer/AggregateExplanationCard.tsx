import type { AggregateExplanation } from "../shared/product-api.js";

function evidenceLabel(
  explanation: AggregateExplanation,
  reference: AggregateExplanation["findings"][number]["evidence"][number],
): string {
  const column = explanation.disclosure.columns[reference.columnIndex];
  const value = explanation.disclosure.rows[reference.rowIndex]?.[reference.columnIndex];
  return `R${reference.rowIndex + 1} · ${column?.label ?? `列 ${reference.columnIndex + 1}`} = ${value === null ? "—" : String(value)}`;
}

export function AggregateExplanationCard({
  explanation,
  kicker = "APPROVED AGGREGATE INSIGHT",
  title = "AI 聚合解读",
  metric,
}: {
  readonly explanation: AggregateExplanation;
  readonly kicker?: string;
  readonly title?: string;
  readonly metric?: string;
}) {
  return (
    <article className="aggregate-explanation-card">
      <header><div><p className="hero-kicker">{kicker}</p><h3>{title}</h3></div><span>{metric ?? `${explanation.disclosure.rows.length} 个已批准聚合行`}</span></header>
      <p className="aggregate-summary">{explanation.summary}</p>
      <div className="aggregate-findings">
        {explanation.findings.map((finding, index) => <section key={`${finding.title}-${index}`}>
          <strong>{finding.title}</strong>
          <p>{finding.detail}</p>
          <div className="evidence-list">{finding.evidence.map((reference) => <small key={`${reference.rowIndex}-${reference.columnIndex}`}>{evidenceLabel(explanation, reference)}</small>)}</div>
        </section>)}
      </div>
      {explanation.caveats.length > 0 && <div className="aggregate-caveats"><strong>限制</strong>{explanation.caveats.map((item) => <p key={item}>{item}</p>)}</div>}
      {explanation.nextQuestions.length > 0 && <div className="aggregate-next-questions"><strong>可以继续问</strong>{explanation.nextQuestions.map((item) => <p key={item}>{item}</p>)}</div>}
    </article>
  );
}
