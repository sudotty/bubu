import {
  parseAggregateDisclosure,
  type AggregateDisclosure,
  type SafeGroupQueryPlan,
  type SafeGroupQueryResult,
  type SafeQueryPlan,
  type SafeQueryResult,
} from "@bubu/contracts";

const maximumDisclosedAggregateRows = 50;
const minimumAggregateGroupSize = 5;

type AggregateMeasure =
  | SafeQueryPlan["measures"][number]
  | SafeGroupQueryPlan["measures"][number];

function countOutputIndex(dimensions: number, measures: readonly AggregateMeasure[]): number {
  if (measures.some(({ operation }) => operation === "minimum" || operation === "maximum")) {
    throw new Error("Aggregate model disclosure cannot include minimum or maximum values");
  }
  const countIndex = measures.findIndex((measure) =>
    measure.operation === "count" && measure.column === null);
  if (countIndex < 0) {
    throw new Error("Aggregate model disclosure requires a COUNT(*) measure");
  }
  return dimensions + countIndex;
}

function disclosureFromResult(
  question: string,
  purpose: string,
  target: AggregateDisclosure["target"],
  sourceCount: number,
  dimensionCount: number,
  measures: readonly AggregateMeasure[],
  result: Pick<SafeQueryResult, "columns" | "rows" | "truncated">,
): AggregateDisclosure {
  const countIndex = countOutputIndex(dimensionCount, measures);
  if (result.columns.length !== dimensionCount + measures.length) {
    throw new Error("Aggregate result shape does not match its reviewed plan");
  }
  const rows = result.rows.slice(0, maximumDisclosedAggregateRows);
  if (rows.length === 0) throw new Error("An empty aggregate result cannot be explained");
  for (const row of rows) {
    const count = row[countIndex];
    if (typeof count !== "number" || !Number.isInteger(count) || count < minimumAggregateGroupSize) {
      throw new Error("Every disclosed aggregate group must contain at least 5 rows");
    }
  }
  return parseAggregateDisclosure({
    schemaVersion: 1,
    target,
    question,
    purpose,
    sourceCount,
    columns: result.columns.map((column) => ({ ...column })),
    rows: rows.map((row) => [...row]),
    truncated: result.truncated || result.rows.length > maximumDisclosedAggregateRows,
    minimumGroupSize: minimumAggregateGroupSize,
  });
}

export function deriveAggregateDisclosure(
  question: string,
  plan: SafeQueryPlan,
  result: SafeQueryResult,
): AggregateDisclosure {
  if (plan.datasetId !== result.datasetId || plan.versionId !== result.versionId) {
    throw new Error("Aggregate result does not match the reviewed immutable version");
  }
  return disclosureFromResult(
    question,
    plan.purpose,
    { kind: "dataset", id: plan.datasetId },
    1,
    plan.dimensions.length,
    plan.measures,
    result,
  );
}

export function deriveGroupAggregateDisclosure(
  question: string,
  plan: SafeGroupQueryPlan,
  result: SafeGroupQueryResult,
): AggregateDisclosure {
  const sourcesMatch = plan.groupId === result.groupId &&
    plan.sources.length === result.sourceVersions.length &&
    plan.sources.every((source, index) => {
      const actual = result.sourceVersions[index];
      return source.datasetId === actual?.datasetId && source.versionId === actual.versionId;
    });
  if (!sourcesMatch) {
    throw new Error("Aggregate group result does not match the reviewed immutable sources");
  }
  return disclosureFromResult(
    question,
    plan.purpose,
    { kind: "group", id: plan.groupId },
    plan.sources.length,
    plan.dimensions.length,
    plan.measures,
    result,
  );
}
