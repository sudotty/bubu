import { lstatSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const integer = (value) => Number.isInteger(value) && value >= 0;
const sha256 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const fileDigest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const regularFileMatches = (path, digest) => {
  try { const stat = lstatSync(path); return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 && fileDigest(path) === digest; }
  catch { return false; }
};

export function validatePublicBetaEvidence(value) {
  const failures = [];
  const keys = ["schemaVersion", "releaseTag", "reviewedAt", "reviewer", "signedArtifacts", "cleanDevices", "updateSafety"];
  if (!exactKeys(value, keys)) return ["public-beta evidence has unknown or missing fields"];
  if (value.schemaVersion !== 1 || !/^v\d+\.\d+\.\d+$/u.test(value.releaseTag) || !Number.isFinite(Date.parse(value.reviewedAt)) || typeof value.reviewer !== "string" || value.reviewer.trim().length < 2) failures.push("public-beta identity fields are invalid");
  const targets = new Set(["macos-arm64", "macos-x64", "windows-x64"]);
  if (!Array.isArray(value.signedArtifacts) || value.signedArtifacts.length !== 3) failures.push("all three signed artifact targets are required");
  else for (const artifact of value.signedArtifacts) {
    if (!exactKeys(artifact, ["target", "artifactPath", "sha256", "publisherSignatureVerified", "notarizationVerified", "staplingVerified"]) || !targets.delete(artifact.target) || typeof artifact.artifactPath !== "string" || !sha256(artifact.sha256) || !regularFileMatches(artifact.artifactPath, artifact.sha256) || artifact.publisherSignatureVerified !== true || (artifact.target.startsWith("macos-") && (artifact.notarizationVerified !== true || artifact.staplingVerified !== true))) failures.push("signed artifact evidence is incomplete, unbound, or duplicated");
  }
  const deviceTargets = new Set(["macos-arm64", "macos-x64", "windows-x64"]);
  if (!Array.isArray(value.cleanDevices) || value.cleanDevices.length !== 3) failures.push("all three clean-device targets are required");
  else for (const device of value.cleanDevices) {
    if (!exactKeys(device, ["target", "reportPath", "reportSha256", "install", "launch", "import", "task", "backup", "upgrade", "restore", "rollback", "uninstall"]) || !deviceTargets.delete(device.target) || typeof device.reportPath !== "string" || !sha256(device.reportSha256) || !regularFileMatches(device.reportPath, device.reportSha256) || Object.entries(device).some(([key, passed]) => !["target", "reportPath", "reportSha256"].includes(key) && passed !== true)) failures.push("clean-device lifecycle evidence is incomplete, unbound, or duplicated");
  }
  if (!exactKeys(value.updateSafety, ["reportPath", "reportSha256", "signedMetadata", "packageDigest", "upgrade", "rollback", "downgradeRejected"])
    || typeof value.updateSafety.reportPath !== "string"
    || !sha256(value.updateSafety.reportSha256)
    || !regularFileMatches(value.updateSafety.reportPath, value.updateSafety.reportSha256)
    || Object.entries(value.updateSafety).some(([key, passed]) => !["reportPath", "reportSha256"].includes(key) && passed !== true)) failures.push("signed update and rollback safety evidence is incomplete or unbound");
  return failures;
}

export function validatePilotEvidence(value) {
  const failures = [];
  const keys = ["schemaVersion", "reviewedAt", "participants", "consentedParticipants", "firstTaskCompleted", "firstArtifactMinutes", "nextPeriodEligible", "nextPeriodReturned", "pausedTasks", "recoveredPausedTasks", "successfulTasks", "reportBundles", "silentSemanticChanges", "unapprovedDisclosures", "paidPilotOrPurchaseIntent"];
  if (!exactKeys(value, keys)) return ["pilot evidence has unknown or missing fields"];
  for (const key of keys.filter((key) => !["reviewedAt", "firstArtifactMinutes"].includes(key))) if (key !== "schemaVersion" && !integer(value[key])) failures.push(`${key} must be a nonnegative integer`);
  if (value.schemaVersion !== 1 || !Number.isFinite(Date.parse(value.reviewedAt))) failures.push("pilot evidence version or review time is invalid");
  if (value.participants < 5 || value.participants > 10 || value.consentedParticipants !== value.participants) failures.push("pilot requires 5-10 consented participants");
  if (value.firstTaskCompleted > value.participants) failures.push("first-task completions cannot exceed participants");
  if (value.nextPeriodEligible > value.participants || value.nextPeriodReturned > value.nextPeriodEligible) failures.push("next-period counts are inconsistent");
  if (value.recoveredPausedTasks > value.pausedTasks) failures.push("recovered paused tasks cannot exceed paused tasks");
  if (value.reportBundles > value.successfulTasks) failures.push("report bundles cannot exceed successful tasks");
  if (value.paidPilotOrPurchaseIntent > value.participants) failures.push("commercial intent cannot exceed participants");
  if (!Array.isArray(value.firstArtifactMinutes) || value.firstArtifactMinutes.length !== value.firstTaskCompleted || value.firstArtifactMinutes.some((minutes) => typeof minutes !== "number" || minutes < 0 || minutes > 1_440)) failures.push("first Artifact timing evidence is invalid");
  const sorted = [...(Array.isArray(value.firstArtifactMinutes) ? value.firstArtifactMinutes : [])].sort((a, b) => a - b);
  const median = sorted.length === 0 ? Infinity : sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  if (value.firstTaskCompleted / value.participants < 0.7 || median > 10) failures.push("first-task activation thresholds are not met");
  if (value.nextPeriodEligible < 3 || value.nextPeriodReturned / value.nextPeriodEligible < 0.5) failures.push("next-period return threshold is not met");
  if (value.pausedTasks > 0 && value.recoveredPausedTasks / value.pausedTasks < 0.8) failures.push("paused-task recovery threshold is not met");
  if (value.successfulTasks < 1 || value.reportBundles / value.successfulTasks < 0.6) failures.push("report delivery threshold is not met");
  if (value.silentSemanticChanges !== 0 || value.unapprovedDisclosures !== 0) failures.push("safety threshold requires zero violations");
  if (value.paidPilotOrPurchaseIntent < 3) failures.push("commercial intent threshold is not met");
  return failures;
}

export function readEvidence(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
