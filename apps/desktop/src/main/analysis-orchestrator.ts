import {
  parseGroupQueryPlanProposal,
  parseQueryPlanProposal,
  parseSafeGroupQueryPlanText,
  parseSafeQueryPlanText,
  type GroupQueryPlanProposal,
  type ModelCompletion,
  type ModelContext,
  type ModelInvocation,
  type QueryPlanProposal,
} from "@bubu/contracts";
import type { ResolvedProvider } from "./provider-store.js";

const queryPlannerInstruction = `You convert a user's spreadsheet question into one bounded relational query plan.
Return exactly one JSON object. Do not use Markdown, code fences, comments, prose outside JSON, or SQL.
Use only exact column names and dataset/version IDs from the supplied context.
The object fields are: schemaVersion (1), datasetId, versionId, purpose, dimensions, measures, filters, sort, limit.
dimensions is an array of selected/grouped column names (maximum 8).
measures is an array (maximum 8). Each item is either {"operation":"count","column":null-or-column} or uses operation sum, average, minimum, maximum with a column.
filters is an array (maximum 20). Value filters use operator equals, not-equals, contains, greater-than, greater-or-equal, less-than, or less-or-equal plus a string value. Null filters use is-null or is-not-null and omit value.
sort references the zero-based outputIndex across dimensions followed by measures, with direction ascending or descending.
limit is 1 through 200. Prefer 50. Never invent joins, formulas, expressions, or fields.`;

const groupQueryPlannerInstruction = `You convert a user's multi-spreadsheet question into one bounded joined query plan.
Return exactly one JSON object. Do not use Markdown, code fences, comments, prose outside JSON, or SQL.
Use only exact column names and dataset/version IDs from the ordered source contexts.
The object fields are schemaVersion (1), groupId, purpose, sources, joins, dimensions, measures, filters, sort, limit.
Copy sources from the contexts in the same order. There are 2 through 8 sources.
Build one connected join tree: joins has sources.length-1 items. Join item 0 must add rightSourceIndex 1 from leftSourceIndex 0; item N must add rightSourceIndex N+1 from any leftSourceIndex 0 through N. Every rightColumn must have unique:true, so put the fact/detail table first and lookup tables on the right. Only inner or left equality joins are allowed. Never create a cross join.
dimensions items contain sourceIndex and column. measures contain operation, sourceIndex, and column; operations are count, sum, average, minimum, maximum. count may use null column for all rows.
filters contain sourceIndex, column, and an allow-listed operator: equals, not-equals, contains, greater-than, greater-or-equal, less-than, less-or-equal, is-null, is-not-null. Value operators require a string value; null operators omit it.
sort references the zero-based outputIndex across dimensions followed by measures. limit is 1 through 200, preferably 50. Never invent formulas, expressions, or fields.`;

export function buildQueryPlanInvocation(
  resolved: ResolvedProvider,
  context: ModelContext,
  question: string,
): ModelInvocation {
  return {
    provider: resolved.profile,
    credential: resolved.credential,
    system: queryPlannerInstruction,
    user: JSON.stringify({ question, context }),
    maxOutputTokens: 4_096,
  };
}

export function createQueryPlanProposal(
  question: string,
  context: ModelContext,
  completion: ModelCompletion,
): QueryPlanProposal {
  return parseQueryPlanProposal({
    question,
    disclosedContext: context,
    plan: parseSafeQueryPlanText(completion.text),
  });
}

export function buildGroupQueryPlanInvocation(
  resolved: ResolvedProvider,
  groupId: string,
  contexts: readonly ModelContext[],
  question: string,
): ModelInvocation {
  return {
    provider: resolved.profile,
    credential: resolved.credential,
    system: groupQueryPlannerInstruction,
    user: JSON.stringify({
      groupId,
      question,
      sources: contexts.map((context, sourceIndex) => ({ sourceIndex, context })),
    }),
    maxOutputTokens: 6_144,
  };
}

export function createGroupQueryPlanProposal(
  question: string,
  contexts: readonly ModelContext[],
  completion: ModelCompletion,
): GroupQueryPlanProposal {
  return parseGroupQueryPlanProposal({
    question,
    disclosedContexts: contexts,
    plan: parseSafeGroupQueryPlanText(completion.text),
  });
}
