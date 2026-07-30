import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validatePilotEvidence, validatePublicBetaEvidence } from "./external-evidence-policy.mjs";

const root = mkdtempSync(join(tmpdir(), "bubu-external-evidence-"));
const evidenceFile = (name, content) => { const path = join(root, name); writeFileSync(path, content); return { path, digest: createHash("sha256").update(content).digest("hex") }; };
const artifact = (target) => { const file = evidenceFile(`${target}.artifact`, `signed ${target}`); return { target, artifactPath: file.path, sha256: file.digest, publisherSignatureVerified: true, notarizationVerified: true, staplingVerified: true }; };
const device = (target) => { const file = evidenceFile(`${target}.json`, JSON.stringify({ target, observed: true })); return { target, reportPath: file.path, reportSha256: file.digest, install: true, launch: true, import: true, task: true, backup: true, upgrade: true, restore: true, rollback: true, uninstall: true }; };
const updateSafety = () => { const file = evidenceFile("update-safety.json", JSON.stringify({ signedUpdateObserved: true })); return { reportPath: file.path, reportSha256: file.digest, signedMetadata: true, packageDigest: true, upgrade: true, rollback: true, downgradeRejected: true }; };

test("public beta needs signed update, artifact, and clean-device evidence", () => {
  assert.deepEqual(validatePublicBetaEvidence({ schemaVersion: 1, releaseTag: "v1.0.0", reviewedAt: "2026-07-29T00:00:00.000Z", reviewer: "release owner", signedArtifacts: [artifact("macos-arm64"), artifact("macos-x64"), artifact("windows-x64")], cleanDevices: [device("macos-arm64"), device("macos-x64"), device("windows-x64")], updateSafety: updateSafety() }), []);
});

test("public beta rejects evidence that is not bound to the referenced files", () => {
  const altered = artifact("macos-arm64");
  writeFileSync(altered.artifactPath, "changed after review");
  assert.ok(validatePublicBetaEvidence({ schemaVersion: 1, releaseTag: "v1.0.0", reviewedAt: "2026-07-29T00:00:00.000Z", reviewer: "release owner", signedArtifacts: [altered, artifact("macos-x64"), artifact("windows-x64")], cleanDevices: [device("macos-arm64"), device("macos-x64"), device("windows-x64")], updateSafety: updateSafety() }).length > 0);
});

test("pilot threshold evidence passes only with consent, repeat use, safety, and intent", () => {
  assert.deepEqual(validatePilotEvidence({ schemaVersion: 1, reviewedAt: "2026-07-29T00:00:00.000Z", participants: 5, consentedParticipants: 5, firstTaskCompleted: 4, firstArtifactMinutes: [4, 6, 8, 10], nextPeriodEligible: 4, nextPeriodReturned: 2, pausedTasks: 5, recoveredPausedTasks: 4, successfulTasks: 5, reportBundles: 3, silentSemanticChanges: 0, unapprovedDisclosures: 0, paidPilotOrPurchaseIntent: 3 }), []);
  assert.ok(validatePilotEvidence({ schemaVersion: 1, reviewedAt: "2026-07-29T00:00:00.000Z", participants: 5, consentedParticipants: 4, firstTaskCompleted: 1, firstArtifactMinutes: [20], nextPeriodEligible: 1, nextPeriodReturned: 0, pausedTasks: 2, recoveredPausedTasks: 0, successfulTasks: 1, reportBundles: 0, silentSemanticChanges: 1, unapprovedDisclosures: 1, paidPilotOrPurchaseIntent: 0 }).length > 0);
  assert.ok(validatePilotEvidence({ schemaVersion: 1, reviewedAt: "2026-07-29T00:00:00.000Z", participants: 5, consentedParticipants: 5, firstTaskCompleted: 6, firstArtifactMinutes: [1, 1, 1, 1, 1, 1], nextPeriodEligible: 3, nextPeriodReturned: 99, pausedTasks: 1, recoveredPausedTasks: 99, successfulTasks: 1, reportBundles: 99, silentSemanticChanges: 0, unapprovedDisclosures: 0, paidPilotOrPurchaseIntent: 99 }).length > 0);
});
