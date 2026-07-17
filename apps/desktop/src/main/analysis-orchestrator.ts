import {
  parseQueryPlanProposal,
  parseSafeQueryPlanText,
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
