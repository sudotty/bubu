import assert from "node:assert/strict";
import test from "node:test";
import { assertPullRequestTitle, requiresNativePackage } from "./ci-policy.mjs";

test("routes every native build and smoke dependency to the package matrix", () => {
  assert.equal(requiresNativePackage(["docs/README.md"]), false);
  assert.equal(requiresNativePackage(["apps/desktop/src/main/index.ts"]), true);
  assert.equal(requiresNativePackage(["scripts/smoke-packaged-desktop.mjs"]), true);
  assert.equal(requiresNativePackage(["scripts/native-signature-verifier.mjs"]), true);
  assert.equal(requiresNativePackage([".github/workflows/release.yml"]), true);
});

test("keeps squash titles compact and conventional", () => {
  assert.doesNotThrow(() => assertPullRequestTitle("fix(release): bind tags to protected main"));
  assert.throws(() => assertPullRequestTitle("Update things"), /type\(scope\)/u);
});
