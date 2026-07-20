import test from "node:test";
import assert from "node:assert/strict";
import { checksumLines, classifyMakeArtifact, releaseAssetName, resolveReleaseTarget } from "./release-artifacts.mjs";

test("names every stable installer artifact with version and target", () => {
  assert.equal(releaseAssetName("1.2.3", "darwin", "arm64", "dmg"), "BuBu-1.2.3-macos-arm64.dmg");
  assert.equal(releaseAssetName("1.2.3", "darwin", "x64", "zip"), "BuBu-1.2.3-macos-x64.zip");
  assert.equal(releaseAssetName("1.2.3", "win32", "x64", "setup"), "BuBu-1.2.3-windows-x64-Setup.exe");
  assert.equal(releaseAssetName("1.2.3", "win32", "x64", "nupkg", "BuBu-1.2.3-full.nupkg"), "BuBu-1.2.3-windows-x64-full.nupkg");
});

test("rejects targets outside the stable support contract", () => {
  assert.throws(() => resolveReleaseTarget("win32", "arm64"), /Unsupported stable release target/u);
  assert.throws(() => resolveReleaseTarget("linux", "x64"), /Unsupported stable release target/u);
});

test("classifies maker output without accepting unrelated files", () => {
  assert.equal(classifyMakeArtifact("darwin", "/out/BuBu.dmg"), "dmg");
  assert.equal(classifyMakeArtifact("win32", "C:/out/BuBu-Setup.exe"), "setup");
  assert.equal(classifyMakeArtifact("win32", "C:/out/RELEASES"), "releases");
  assert.equal(classifyMakeArtifact("win32", "C:/out/debug.txt"), undefined);
});

test("renders deterministic checksum inventory", () => {
  assert.equal(checksumLines([
    { name: "b.zip", sha256: "bbb" },
    { name: "a.dmg", sha256: "aaa" },
  ]), "aaa  a.dmg\nbbb  b.zip");
});
