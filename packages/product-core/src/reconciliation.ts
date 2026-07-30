import { parseComparisonPlan, parseReconciliationPlan, type ComparisonPlan, type ReconciliationPlan } from "@bubu/contracts";

export interface KeyFrequency {
  readonly key: string;
  readonly count: number;
}

export interface ComparisonCardinalityPreview {
  readonly candidatePairs: number;
  readonly duplicateLeftRows: number;
  readonly duplicateRightRows: number;
  readonly withinBudget: boolean;
  readonly cardinalityAllowed: boolean;
}

export function canonicalComparisonPlan(value: ComparisonPlan): string {
  const plan = parseComparisonPlan(value);
  return JSON.stringify(plan);
}

export function canonicalReconciliationPlan(value: ReconciliationPlan): string {
  const plan = parseReconciliationPlan(value);
  return JSON.stringify({
    schemaVersion: plan.schemaVersion,
    purpose: plan.purpose,
    comparison: JSON.parse(canonicalComparisonPlan(plan.comparison)),
    controlTotals: plan.controlTotals,
    unresolvedPolicy: plan.unresolvedPolicy,
  });
}

export function previewComparisonCardinality(
  planValue: ComparisonPlan,
  left: readonly KeyFrequency[],
  right: readonly KeyFrequency[],
): ComparisonCardinalityPreview {
  const plan = parseComparisonPlan(planValue);
  const leftCounts = new Map(left.map(({ key, count }) => [key, count]));
  const rightCounts = new Map(right.map(({ key, count }) => [key, count]));
  let candidatePairs = 0;
  let duplicateLeftRows = 0;
  let duplicateRightRows = 0;
  let cardinalityAllowed = true;
  for (const [key, leftCount] of leftCounts) {
    const rightCount = rightCounts.get(key) ?? 0;
    if (leftCount > 1) duplicateLeftRows += leftCount;
    if (rightCount > 1) duplicateRightRows += rightCount;
    candidatePairs += leftCount * rightCount;
    if (leftCount > 1 || (plan.match.cardinality === "one-to-one" && rightCount > 1)) cardinalityAllowed = false;
    if (candidatePairs > plan.budgets.maximumCandidatePairs) break;
  }
  for (const [key, rightCount] of rightCounts) if (!leftCounts.has(key) && rightCount > 1) duplicateRightRows += rightCount;
  return { candidatePairs, duplicateLeftRows, duplicateRightRows, withinBudget: candidatePairs <= plan.budgets.maximumCandidatePairs, cardinalityAllowed };
}
