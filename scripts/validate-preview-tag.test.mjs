import assert from "node:assert/strict";
import test from "node:test";
import { previewVersion } from "./validate-preview-tag.mjs";

test("accepts preview tags backed by valid semantic versions", () => {
  assert.equal(previewVersion("preview-v0.1.0"), "0.1.0");
  assert.equal(previewVersion("preview-v1.2.3-rc.1+build.7"), "1.2.3-rc.1+build.7");
});

test("rejects stable, malformed, and ambiguous preview tags", () => {
  for (const tag of [
    "v1.2.3",
    "preview-v1.2",
    "preview-v01.2.3",
    "preview-v1.2.3-01",
    "preview-v1.2.3/extra",
    "preview-v1.2.3 rc.1",
  ]) {
    assert.throws(() => previewVersion(tag), /Preview tag|Expected preview-v<SemVer>/u);
  }
});
