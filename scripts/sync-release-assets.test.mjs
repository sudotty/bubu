import assert from "node:assert/strict";
import test from "node:test";
import { staleReleaseAssets } from "./sync-release-assets.mjs";

test("identifies only remote assets outside the new exact inventory", () => {
  assert.deepEqual(staleReleaseAssets([
    { id: 1, name: "current.dmg" },
    { id: 2, name: "stale.zip" },
  ], ["current.dmg"]), [{ id: 2, name: "stale.zip" }]);
});
