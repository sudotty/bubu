import { parseReconciliationPreviewRequest, parseReconciliationProposal, type ReconciliationPreview, type ReconciliationPreviewRequest, type ReconciliationProposal } from "@bubu/contracts";

const approvalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumSessions = 20;

interface Options { readonly now: () => number; readonly newToken: () => string }
interface Pending { readonly request: ReconciliationPreviewRequest; readonly preview: ReconciliationPreview; readonly expiresAt: number; readonly reviewedAt: string }
export interface ApprovedReconciliation { readonly request: ReconciliationPreviewRequest; readonly preview: ReconciliationPreview; readonly reviewedAt: string }

export function createReconciliationApprovalSessionStore(options: Options) {
  const pending = new Map<string, Pending>();
  function removeExpired(): void { const now = options.now(); for (const [token, session] of pending) if (session.expiresAt < now) pending.delete(token); }
  return {
    issue(request: ReconciliationPreviewRequest, preview: ReconciliationPreview): ReconciliationProposal {
      removeExpired();
      while (pending.size >= maximumSessions) { const oldest = pending.keys().next().value as string | undefined; if (!oldest) break; pending.delete(oldest); }
      const approvalToken = options.newToken();
      if (pending.has(approvalToken)) throw new Error("Could not allocate a unique reconciliation approval");
      const expiresAt = options.now() + approvalLifetimeMilliseconds;
      const proposal = parseReconciliationProposal({ approvalToken, expiresAt: new Date(expiresAt).toISOString(), request, preview });
      pending.set(approvalToken, { request: parseReconciliationPreviewRequest(proposal.request), preview: proposal.preview, expiresAt, reviewedAt: new Date(options.now()).toISOString() });
      return proposal;
    },
    consume(token: string): ApprovedReconciliation {
      const session = pending.get(token); pending.delete(token);
      if (!session || session.expiresAt < options.now()) throw new Error("Reconciliation approval expired or has already been used");
      return { request: session.request, preview: session.preview, reviewedAt: session.reviewedAt };
    },
    revoke(token: string): void { pending.delete(token); },
  };
}
