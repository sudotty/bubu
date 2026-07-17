import {
  parseAggregateExplanationProposal,
  type AggregateDisclosure,
  type AggregateExplanationProposal,
} from "@bubu/contracts";

const aggregateApprovalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumAggregateApprovalSessions = 20;

type ModelDestination = AggregateExplanationProposal["destination"];
type ApprovedAggregate = Pick<AggregateExplanationProposal, "disclosure" | "destination">;

interface AggregateApprovalSessionOptions {
  readonly now: () => number;
  readonly newToken: () => string;
}

interface PendingAggregateApproval extends ApprovedAggregate {
  readonly expiresAt: number;
}

export interface AggregateApprovalSessionStore {
  issue(disclosure: AggregateDisclosure, destination: ModelDestination): AggregateExplanationProposal;
  consume(token: string): ApprovedAggregate;
  revoke(token: string): void;
}

export function createAggregateApprovalSessionStore(
  options: AggregateApprovalSessionOptions,
): AggregateApprovalSessionStore {
  const pending = new Map<string, PendingAggregateApproval>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) {
      if (session.expiresAt < now) pending.delete(token);
    }
  }

  return {
    issue(disclosure, destination) {
      removeExpired();
      while (pending.size >= maximumAggregateApprovalSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique aggregate approval");
      const expiresAt = options.now() + aggregateApprovalLifetimeMilliseconds;
      const proposal = parseAggregateExplanationProposal({
        approvalToken,
        expiresAt: new Date(expiresAt).toISOString(),
        destination,
        disclosure,
      });
      pending.set(approvalToken, {
        disclosure: proposal.disclosure,
        destination: proposal.destination,
        expiresAt,
      });
      return proposal;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt < options.now()) {
        throw new Error("Aggregate approval expired or has already been used");
      }
      return { disclosure: session.disclosure, destination: session.destination };
    },
    revoke(token) {
      pending.delete(token);
    },
  };
}
