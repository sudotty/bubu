import test from "node:test";
import assert from "node:assert/strict";
import { advisoriesAtOrAbove, collectLockedPackageVersions, parseBulkAdvisories } from "./npm-bulk-audit.mjs";

test("collects every distinct installed package version without workspace metadata", () => {
  assert.deepEqual(collectLockedPackageVersions({
    packages: {
      "": { name: "workspace", version: "1.0.0" },
      "apps/desktop": { name: "@workspace/desktop", version: "1.0.0" },
      "node_modules/plain": { version: "2.0.0" },
      "node_modules/parent/node_modules/plain": { version: "1.0.0" },
      "node_modules/@scope/package": { version: "3.0.0" },
      "node_modules/@workspace/desktop": { link: true },
    },
  }), {
    "@scope/package": ["3.0.0"],
    plain: ["1.0.0", "2.0.0"],
  });
});

test("strictly parses bulk advisories and applies the configured severity floor", () => {
  const advisories = parseBulkAdvisories({
    example: [{
      id: 123,
      severity: "high",
      title: "Example advisory",
      url: "https://github.com/advisories/GHSA-example",
      vulnerable_versions: "<2.0.0",
    }],
  });

  assert.equal(advisoriesAtOrAbove(advisories, "low").length, 1);
  assert.equal(advisoriesAtOrAbove(advisories, "critical").length, 0);
  assert.throws(() => parseBulkAdvisories({ example: [{ severity: "unknown" }] }), /invalid shape/u);
});
