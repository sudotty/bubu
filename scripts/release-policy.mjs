import { lifecycleSteps } from "./native-installer-policy.mjs";

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const previewVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function parseStableVersion(value) {
  const match = stableVersionPattern.exec(value ?? "");
  if (!match) throw new Error(`Expected stable semantic version; received ${String(value)}`);
  return Object.freeze({ raw: value, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) });
}

export function compareStableVersions(left, right) {
  for (const key of ["major", "minor", "patch"]) {
    const difference = left[key] - right[key];
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function selectPreviousStableRelease(releases, currentTag) {
  const current = parseStableVersion(currentTag?.startsWith("v") ? currentTag.slice(1) : "");
  return releases
    .filter((release) => release?.draft === false && release?.prerelease === false)
    .map((release) => {
      if (typeof release.tag_name !== "string" || !release.tag_name.startsWith("v")) return undefined;
      try {
        return { release, version: parseStableVersion(release.tag_name.slice(1)) };
      } catch {
        return undefined;
      }
    })
    .filter((value) => value && compareStableVersions(value.version, current) < 0)
    .sort((left, right) => compareStableVersions(right.version, left.version))[0]?.release;
}

export function assertReleaseTagVersion({ channel, tag, version }) {
  if (channel === "stable") {
    parseStableVersion(version);
    if (tag !== `v${version}`) throw new Error(`Stable tag ${tag} does not match version ${version}`);
    return;
  }
  if (channel !== "preview" || !previewVersionPattern.test(version) || tag !== `preview-v${version}`) {
    throw new Error(`Preview tag ${tag} does not match version ${version}`);
  }
}

function exactStringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string") || new Set(value).size !== value.length) {
    throw new Error(`${name} must be an array of unique strings`);
  }
  return value;
}

export function validateSmokeEvidence(report, { platform, arch, channel }) {
  if (!report || typeof report !== "object" || Array.isArray(report) || report.schemaVersion !== 1) {
    throw new Error("Installer smoke report must use schemaVersion 1");
  }
  if (report.platform !== platform || report.arch !== arch) {
    throw new Error(`Smoke report target ${report.platform}-${report.arch} does not match ${platform}-${arch}`);
  }
  if (typeof report.artifact !== "string" || report.artifact.trim() === "") throw new Error("Smoke report artifact is missing");
  const passed = exactStringArray(report.passed, "Smoke passed steps");
  const hasPrevious = report.upgrade === "passed";
  if (!hasPrevious && report.upgrade !== "skipped-no-previous-artifact") throw new Error(`Invalid smoke upgrade state: ${report.upgrade}`);
  const requiredSteps = exactStringArray(report.requiredSteps, "Smoke required steps");
  const expectedSteps = lifecycleSteps(hasPrevious);
  if (JSON.stringify(requiredSteps) !== JSON.stringify(expectedSteps)) throw new Error("Smoke required steps do not match the lifecycle contract");
  for (const step of ["install", "launch-import-task-backup-restore", "uninstall"]) {
    if (!passed.includes(step)) throw new Error(`Smoke report did not pass ${step}`);
  }
  if (hasPrevious && (!passed.includes("previous-version-install") || !passed.includes("upgrade"))) {
    throw new Error("Smoke report did not prove a real previous-version upgrade");
  }
  if (channel === "stable" && hasPrevious && !passed.includes("previous-installer-signature")) {
    throw new Error("Stable smoke report did not verify the previous installer signature");
  }
  if (channel === "stable" && report.signature !== "passed") throw new Error("Stable smoke report must prove native signatures");
  if (channel === "preview" && report.signature !== "not-requested") throw new Error("Preview smoke report must remain unsigned");
  if (!new Set(["stable", "preview"]).has(channel)) throw new Error(`Unsupported release channel: ${channel}`);
  return Object.freeze({ hasPrevious, passed: Object.freeze([...passed]) });
}

export function parseChecksumInventory(text) {
  const entries = new Map();
  for (const line of String(text).split(/\r?\n/u).filter(Boolean)) {
    const match = /^([a-f0-9]{64})  ([^/\\]+)$/u.exec(line);
    if (!match) throw new Error(`Invalid SHA256SUMS line: ${line}`);
    if (entries.has(match[2])) throw new Error(`Duplicate checksum entry: ${match[2]}`);
    entries.set(match[2], match[1]);
  }
  return entries;
}

export function successfulRequiredChecks(checkRuns) {
  const required = ["Fast product contract", "Pull request policy", "Analyze javascript-typescript", "Analyze go"];
  const successful = new Set((checkRuns ?? [])
    .filter((check) => check?.app?.id === 15368 && check?.conclusion === "success")
    .map((check) => check.name));
  return Object.freeze({ required, missing: required.filter((name) => !successful.has(name)) });
}
