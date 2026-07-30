import {
  parseAggregateExplanationProposal,
  type AggregateDisclosure,
  type AggregateExplanationProposal,
  type PromptTemplate,
} from "@bubu/contracts";
import { createOneUseAuthorizationStore } from "./one-use-authorization-store.js";

const aggregateApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumAggregateApprovalSessions = 20;

type ModelDestination = AggregateExplanationProposal["destination"];
type ApprovedAggregate = Pick<AggregateExplanationProposal, "disclosure" | "destination" | "promptTemplate"> & { readonly threadId: string };

interface AggregateApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

export interface AggregateApprovalSessionStore {
  issue(disclosure: AggregateDisclosure, destination: ModelDestination, threadId: string, promptTemplate: PromptTemplate): AggregateExplanationProposal;
  consume(token: string): ApprovedAggregate;
  revoke(token: string): void;
}

export function createAggregateApprovalSessionStore(
  options: AggregateApprovalSessionOptions,
): AggregateApprovalSessionStore {
  const authorizations = createOneUseAuthorizationStore<ApprovedAggregate>({ ...options, lifetimeMilliseconds: aggregateApprovalLifetimeMilliseconds, maximumSessions: maximumAggregateApprovalSessions, allocationError: "Could not allocate a unique aggregate approval", consumeError: "Aggregate approval expired or has already been used" });

  return {
    issue(disclosure, destination, threadId, promptTemplate) {
      const authorization = authorizations.issue({ disclosure, destination, promptTemplate, threadId });
      const proposal = parseAggregateExplanationProposal({
        approvalToken: authorization.token,
        expiresAt: new Date(authorization.expiresAt).toISOString(),
        destination,
        disclosure,
        promptTemplate,
      });
      return proposal;
    },
    consume(token) {
      return authorizations.consume(token);
    },
    revoke(token) {
      authorizations.revoke(token);
    },
  };
}
