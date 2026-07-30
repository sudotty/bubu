import {
  parseKnowledgeDisclosureProposal,
  type KnowledgeDisclosurePreview,
  type KnowledgeDisclosureProposal,
  type KnowledgeSearchInput,
} from "@bubu/contracts";
import { createOneUseAuthorizationStore } from "./one-use-authorization-store.js";

const lifetimeMilliseconds = 10 * 60 * 1_000;
const maximumSessions = 20;
type Destination = KnowledgeDisclosureProposal["destination"];
type Approved = { readonly search: KnowledgeSearchInput; readonly preview: KnowledgeDisclosurePreview; readonly destination: Destination };

export interface KnowledgeApprovalSessionStore {
  issue(search: KnowledgeSearchInput, preview: KnowledgeDisclosurePreview, destination: Destination): KnowledgeDisclosureProposal;
  consume(token: string): Approved;
  revoke(token: string): void;
}

export function createKnowledgeApprovalSessionStore(options: { readonly now: () => number; readonly newToken: () => string }): KnowledgeApprovalSessionStore {
  const authorizations = createOneUseAuthorizationStore<Approved>({ ...options, lifetimeMilliseconds, maximumSessions, allocationError: "Could not allocate a unique knowledge approval", consumeError: "Knowledge approval expired or has already been used" });
  return {
    issue(search, preview, destination) {
      const authorization = authorizations.issue({ search, preview, destination });
      const proposal = parseKnowledgeDisclosureProposal({ approvalToken: authorization.token, expiresAt: new Date(authorization.expiresAt).toISOString(), destination, preview });
      return proposal;
    },
    consume: (token) => authorizations.consume(token),
    revoke: (token) => authorizations.revoke(token),
  };
}
