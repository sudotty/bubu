import {
  aggregateAgentBudget,
  parseAggregateAgentProposal,
  type AggregateAgentProposal,
  type AggregateDisclosure,
} from "@bubu/contracts";

const aggregateAgentApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumAggregateAgentApprovalSessions = 20;

type ModelDestination = AggregateAgentProposal["destination"];
type ApprovedAggregateAgent = Pick<AggregateAgentProposal, "disclosure" | "destination" | "budget"> & { readonly threadId: string };

interface AggregateAgentApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

interface PendingAggregateAgentApproval extends ApprovedAggregateAgent {
  readonly expiresAt: number;
}

export interface AggregateAgentApprovalSessionStore {
  issue(disclosure: AggregateDisclosure, destination: ModelDestination, threadId: string): AggregateAgentProposal;
  consume(token: string): ApprovedAggregateAgent;
  revoke(token: string): void;
}

export function createAggregateAgentApprovalSessionStore(
  options: AggregateAgentApprovalSessionOptions,
): AggregateAgentApprovalSessionStore {
  const pending = new Map<string, PendingAggregateAgentApproval>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt < now) pending.delete(token);
    }
  }

  return {
    issue(disclosure, destination, threadId) {
      removeExpired();
      while (pending.size >= maximumAggregateAgentApprovalSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique aggregate agent approval");
      const expiresAt = options.now() + aggregateAgentApprovalLifetimeMilliseconds;
      const proposal = parseAggregateAgentProposal({
        approvalToken,
        expiresAt: new Date(expiresAt).toISOString(),
        destination,
        disclosure,
        budget: aggregateAgentBudget,
      });
      pending.set(approvalToken, {
        disclosure: proposal.disclosure,
        destination: proposal.destination,
        budget: proposal.budget,
        threadId,
        expiresAt,
      });
      return proposal;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt < options.now()) {
        throw new Error("Aggregate agent approval expired or has already been used");
      }
      return {
        disclosure: session.disclosure,
        destination: session.destination,
        budget: session.budget,
        threadId: session.threadId,
      };
    },
    revoke(token) {
      pending.delete(token);
    },
  };
}
