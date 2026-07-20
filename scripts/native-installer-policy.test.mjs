import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDistinctUpgrade,
  assertNativeInstaller,
  lifecycleSteps,
  packagedSmokeTimeoutMs,
} from "./native-installer-policy.mjs";

test("requires the native installer format", () => {
  assert.doesNotThrow(() => assertNativeInstaller("darwin", "/tmp/BuBu.dmg"));
  assert.doesNotThrow(() => assertNativeInstaller("win32", "C:\\BuBu-Setup.exe"));
  assert.throws(() => assertNativeInstaller("darwin", "/tmp/BuBu.zip"), /DMG/u);
  assert.throws(() => assertNativeInstaller("linux", "/tmp/BuBu.deb"), /unsupported/u);
});

test("never represents a missing previous artifact as an upgrade pass", () => {
  assert.ok(lifecycleSteps(false).includes("upgrade-skipped-no-previous-artifact"));
  assert.ok(lifecycleSteps(true).includes("upgrade"));
});

test("rejects same-build upgrade evidence", () => {
  assert.throws(() => assertDistinctUpgrade("current.dmg", "previous.dmg", "same", "same"), /distinct previous release/u);
  assert.doesNotThrow(() => assertDistinctUpgrade("current.dmg", "previous.dmg", "current", "previous"));
});

test("gives a cold Windows installer launch enough time for the full product smoke", () => {
  assert.equal(packagedSmokeTimeoutMs("win32"), 60_000);
  assert.equal(packagedSmokeTimeoutMs("darwin"), 30_000);
});
