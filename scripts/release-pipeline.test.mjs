import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import test from "node:test";
import { RELEASE_TARGETS, releaseAssetName, sha256 } from "./release-artifacts.mjs";

function run(script, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [resolve("scripts", script), ...args], { encoding: "utf8", stdio: "pipe" });
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

function smoke(platform, arch, artifact) {
  return {
    schemaVersion: 1,
    platform,
    arch,
    artifact,
    requiredSteps: ["install", "launch-import-task-backup-restore", "upgrade-skipped-no-previous-artifact", "uninstall"],
    passed: ["install", "launch-import-task-backup-restore", "uninstall"],
    upgrade: "skipped-no-previous-artifact",
    signature: "not-requested",
  };
}

test("stages only a complete target with matching smoke evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "bubu-stage-test-"));
  try {
    const makeRoot = join(root, "make");
    const output = join(root, "output");
    mkdirSync(makeRoot);
    writeFileSync(join(makeRoot, "BuBu.dmg"), "dmg");
    writeFileSync(join(makeRoot, "BuBu.zip"), "zip");
    const report = join(root, "smoke.json");
    writeFileSync(report, JSON.stringify(smoke("darwin", "arm64", "BuBu.dmg")));
    run("stage-release-assets.mjs", ["--version=1.2.3-rc.1", "--channel=preview", "--platform=darwin", "--arch=arm64", `--make-root=${makeRoot}`, `--smoke-report=${report}`, `--output=${output}`]);
    const manifest = JSON.parse(readFileSync(join(output, "target-manifest.json"), "utf8"));
    assert.equal(manifest.channel, "preview");
    assert.equal(manifest.smoke.sha256, sha256(join(output, manifest.smoke.name)));
    writeFileSync(report, JSON.stringify({ ...smoke("darwin", "arm64", "BuBu.dmg"), signature: "passed" }));
    run("stage-release-assets.mjs", ["--version=1.2.4", "--channel=preview", "--platform=darwin", "--arch=arm64", `--make-root=${makeRoot}`, `--smoke-report=${report}`, `--output=${join(root, "rejected")}`], 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("finalizes only bytes bound by all target manifests", () => {
  const root = mkdtempSync(join(tmpdir(), "bubu-finalize-test-"));
  try {
    const input = join(root, "input");
    mkdirSync(input);
    for (const target of RELEASE_TARGETS) {
      const directory = join(input, target.id);
      mkdirSync(directory);
      const kinds = target.platform === "darwin" ? ["dmg", "zip"] : ["setup", "nupkg", "releases"];
      const artifacts = kinds.map((kind) => {
        const name = releaseAssetName("1.2.3", target.platform, target.arch, kind, kind === "nupkg" ? "full.nupkg" : "");
        const path = join(directory, name);
        writeFileSync(path, `${target.id}-${kind}`);
        return { kind, name, bytes: statSync(path).size, sha256: sha256(path) };
      });
      const smokeName = releaseAssetName("1.2.3", target.platform, target.arch, "smoke");
      const smokePath = join(directory, smokeName);
      writeFileSync(smokePath, JSON.stringify(smoke(target.platform, target.arch, basename(artifacts[0].name))));
      writeFileSync(join(directory, "target-manifest.json"), JSON.stringify({
        schemaVersion: 1,
        channel: "preview",
        version: "1.2.3",
        target,
        artifacts,
        smoke: {
          name: smokeName,
          bytes: statSync(smokePath).size,
          sha256: sha256(smokePath),
          evidence: smoke(target.platform, target.arch, basename(artifacts[0].name)),
        },
      }));
    }
    const output = join(root, "output");
    run("finalize-release-assets.mjs", ["--version=1.2.3", "--tag=preview-v1.2.3", "--channel=preview", `--input=${input}`, `--output=${output}`, "--attestations=disabled"]);
    const manifest = JSON.parse(readFileSync(join(output, "BuBu-1.2.3-release-manifest.json"), "utf8"));
    assert.equal(manifest.targets.length, 3);
    assert.equal(manifest.channel, "preview");

    writeFileSync(join(input, "unaccounted.txt"), "stale");
    run("finalize-release-assets.mjs", ["--version=1.2.3", "--tag=preview-v1.2.3", "--channel=preview", `--input=${input}`, `--output=${join(root, "rejected")}`, "--attestations=disabled"], 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
