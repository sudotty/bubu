import assert from "node:assert/strict";
import test from "node:test";
import {
  assertReleaseTagVersion,
  parseChecksumInventory,
  selectPreviousStableRelease,
  successfulRequiredChecks,
  validateSmokeEvidence,
} from "./release-policy.mjs";

test("selects the highest stable version strictly below the current version", () => {
  const release = selectPreviousStableRelease([
    { tag_name: "v1.9.0", draft: false, prerelease: false, published_at: "2025-01-01" },
    { tag_name: "v2.1.0", draft: false, prerelease: false, published_at: "2024-01-01" },
    { tag_name: "v2.0.0", draft: false, prerelease: false, published_at: "2026-01-01" },
    { tag_name: "v3.0.0", draft: false, prerelease: false, published_at: "2023-01-01" },
    { tag_name: "preview-v2.2.0", draft: false, prerelease: false },
  ], "v2.2.0");
  assert.equal(release.tag_name, "v2.1.0");
});

test("binds stable and preview tags to the exact product version", () => {
  assert.doesNotThrow(() => assertReleaseTagVersion({ channel: "stable", tag: "v1.2.3", version: "1.2.3" }));
  assert.doesNotThrow(() => assertReleaseTagVersion({ channel: "preview", tag: "preview-v1.2.3-rc.1", version: "1.2.3-rc.1" }));
  assert.throws(() => assertReleaseTagVersion({ channel: "stable", tag: "v1.2.4", version: "1.2.3" }), /does not match/u);
});

test("rejects incomplete or unsigned stable smoke evidence", () => {
  const valid = {
    schemaVersion: 1,
    platform: "darwin",
    arch: "arm64",
    artifact: "BuBu.dmg",
    requiredSteps: ["install", "launch-import-task-backup-restore", "upgrade", "uninstall"],
    passed: ["previous-installer-signature", "previous-version-install", "launch-import-task-backup-restore", "install", "upgrade", "signature-and-notarization", "uninstall"],
    upgrade: "passed",
    signature: "passed",
  };
  assert.equal(validateSmokeEvidence(valid, { platform: "darwin", arch: "arm64", channel: "stable" }).hasPrevious, true);
  assert.throws(() => validateSmokeEvidence({ ...valid, signature: "not-requested" }, { platform: "darwin", arch: "arm64", channel: "stable" }), /signatures/u);
  assert.throws(() => validateSmokeEvidence({ ...valid, passed: valid.passed.filter((step) => step !== "upgrade") }, { platform: "darwin", arch: "arm64", channel: "stable" }), /real previous-version upgrade/u);
});

test("parses a strict checksum inventory", () => {
  const digest = "a".repeat(64);
  assert.equal(parseChecksumInventory(`${digest}  BuBu-1.0.0.dmg\n`).get("BuBu-1.0.0.dmg"), digest);
  assert.throws(() => parseChecksumInventory(`${digest} *unsafe/path\n`), /Invalid SHA256SUMS/u);
});

test("requires successful GitHub checks from the Actions app", () => {
  const names = ["Fast product contract", "Pull request policy", "Analyze javascript-typescript", "Analyze go"];
  assert.deepEqual(successfulRequiredChecks(names.map((name) => ({ name, conclusion: "success", app: { id: 15368 } }))).missing, []);
  assert.deepEqual(successfulRequiredChecks([{ name: names[0], conclusion: "success", app: { id: 15368 } }]).missing, names.slice(1));
});
