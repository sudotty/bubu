import {
  parseExplicitRowDisclosureProposal,
  type ExplicitRowDisclosurePreview,
  type ExplicitRowDisclosureProposal,
} from "@bubu/contracts";
import { createOneUseAuthorizationStore } from "./one-use-authorization-store.js";

const approvalLifetimeMilliseconds = 10 * 60 * 1_000;
const maximumExplicitRowApprovalSessions = 20;
type ModelDestination = ExplicitRowDisclosureProposal["destination"];
type ApprovedExplicitRows = { readonly preview: ExplicitRowDisclosurePreview; readonly destination: ModelDestination };

interface Options {
  readonly now: () => number;
  readonly newToken: () => string;
}

export interface ExplicitRowApprovalSessionStore {
  issue(preview: ExplicitRowDisclosurePreview, destination: ModelDestination): ExplicitRowDisclosureProposal;
  consume(token: string): ApprovedExplicitRows;
  revoke(token: string): void;
}

export function createExplicitRowApprovalSessionStore(options: Options): ExplicitRowApprovalSessionStore {
  const authorizations = createOneUseAuthorizationStore<ApprovedExplicitRows>({ ...options, lifetimeMilliseconds: approvalLifetimeMilliseconds, maximumSessions: maximumExplicitRowApprovalSessions, allocationError: "Could not allocate a unique explicit-row approval", consumeError: "Explicit-row approval expired or has already been used" });
  return {
    issue(preview, destination) {
      const authorization = authorizations.issue({ preview, destination });
      const proposal = parseExplicitRowDisclosureProposal({ approvalToken: authorization.token, expiresAt: new Date(authorization.expiresAt).toISOString(), destination, preview });
      return proposal;
    },
    consume: (token) => authorizations.consume(token),
    revoke: (token) => authorizations.revoke(token),
  };
}
