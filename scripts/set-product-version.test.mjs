import test from "node:test";
import assert from "node:assert/strict";
import { assertStableVersion, updateLockfile, updateManifest } from "./set-product-version.mjs";

test("accepts stable semantic product versions only", () => {
  assert.equal(assertStableVersion("1.2.3"), "1.2.3");
  for (const value of ["v1.2.3", "1.2", "1.2.3-beta.1", "01.2.3"]) {
    assert.throws(() => assertStableVersion(value), /stable SemVer/u);
  }
});

test("updates a workspace manifest and its internal contract dependency", () => {
  assert.deepEqual(updateManifest({ version: "0.1.0", dependencies: { "@bubu/contracts": "0.1.0", react: "19" } }, "0.2.0"), {
    version: "0.2.0",
    dependencies: { "@bubu/contracts": "0.2.0", react: "19" },
  });
});

test("updates only product workspace versions in the lockfile", () => {
  const next = updateLockfile({
    version: "0.1.0",
    packages: {
      "": { version: "0.1.0" },
      "apps/desktop": { version: "0.1.0", dependencies: { "@bubu/contracts": "0.1.0" } },
      "packages/contracts": { version: "0.1.0" },
      "services/ai-runtime": { version: "0.1.0", dependencies: { "@bubu/contracts": "0.1.0" } },
      "node_modules/example": { version: "0.1.0" },
    },
  }, "0.2.0");
  assert.equal(next.packages["apps/desktop"].dependencies["@bubu/contracts"], "0.2.0");
  assert.equal(next.packages["node_modules/example"].version, "0.1.0");
});
