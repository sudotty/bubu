import {
  parseDataCleanProposal,
  parseDataCleanPreviewRequest,
  type DataCleanImpactPreview,
  type DataCleanQualityEvidence,
  type DataCleanPreviewRequest,
  type DataCleanProposal,
} from "@bubu/contracts";

const approvalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumSessions = 20;

interface Options {
  readonly now: () => number;
  readonly newToken: () => string;
}

interface Pending {
  readonly request: DataCleanPreviewRequest;
  readonly impact: DataCleanImpactPreview;
  readonly quality: DataCleanQualityEvidence;
  readonly expiresAt: number;
  readonly reviewedAt: string;
}

export interface ApprovedDataClean {
  readonly request: DataCleanPreviewRequest;
  readonly impact: DataCleanImpactPreview;
  readonly quality: DataCleanQualityEvidence;
  readonly reviewedAt: string;
}

export interface DataCleanApprovalSessionStore {
  issue(request: DataCleanPreviewRequest, impact: DataCleanImpactPreview, quality: DataCleanQualityEvidence): DataCleanProposal;
  consume(token: string): ApprovedDataClean;
  revoke(token: string): void;
}

export function createDataCleanApprovalSessionStore(options: Options): DataCleanApprovalSessionStore {
  const pending = new Map<string, Pending>();

  function removeExpired(): void {
    const now = options.now();
    for (const [token, session] of pending) if (session.expiresAt < now) pending.delete(token);
  }

  return {
    issue(request, impact, quality) {
      removeExpired();
      while (pending.size >= maximumSessions) {
        const oldest = pending.keys().next().value as string | undefined;
        if (!oldest) break;
        pending.delete(oldest);
      }
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique data-clean approval");
      const expiresAt = options.now() + approvalLifetimeMilliseconds;
      const reviewedAt = new Date(options.now()).toISOString();
      const proposal = parseDataCleanProposal({ approvalToken, expiresAt: new Date(expiresAt).toISOString(), request, impact, quality });
	  pending.set(approvalToken, { request: parseDataCleanPreviewRequest(proposal.request), impact: proposal.impact, quality: proposal.quality, expiresAt, reviewedAt });
      return proposal;
    },
    consume(token) {
      const session = pending.get(token);
      pending.delete(token);
      if (!session || session.expiresAt < options.now()) throw new Error("Data-clean approval expired or has already been used");
      return { request: session.request, impact: session.impact, quality: session.quality, reviewedAt: session.reviewedAt };
    },
    revoke(token) {
      pending.delete(token);
    },
  };
}
