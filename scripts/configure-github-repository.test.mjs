import assert from "node:assert/strict";
import test from "node:test";
import { allowedExternalActions, requiredGitHubChecks } from "./github-repository-policy.mjs";

test("keeps the remote merge and external Action allowlists exact", () => {
  assert.deepEqual(requiredGitHubChecks, ["Fast product contract", "Pull request policy", "Native package contract", "CodeQL contract"]);
  assert.equal(allowedExternalActions.length, 2);
  assert.ok(allowedExternalActions.every((value) => /@[a-f0-9]{40}$/u.test(value)));
});
