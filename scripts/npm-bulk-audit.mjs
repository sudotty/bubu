import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const severityRank = new Map([
  ["info", 0],
  ["low", 1],
  ["moderate", 2],
  ["high", 3],
  ["critical", 4],
]);

function packageNameFromLockPath(path) {
  const marker = "node_modules/";
  const index = path.lastIndexOf(marker);
  if (index < 0) return undefined;
  const remainder = path.slice(index + marker.length);
  const parts = remainder.split("/");
  if (parts[0]?.startsWith("@")) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : undefined;
  return parts[0] || undefined;
}

export function collectLockedPackageVersions(lock) {
  if (!lock || typeof lock !== "object" || !lock.packages || typeof lock.packages !== "object") {
    throw new Error("package-lock.json must contain a packages object");
  }

  const versionsByName = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!entry || typeof entry !== "object" || typeof entry.version !== "string") continue;
    const name = packageNameFromLockPath(path);
    if (!name) continue;
    const versions = versionsByName.get(name) ?? new Set();
    versions.add(entry.version);
    versionsByName.set(name, versions);
  }

  return Object.fromEntries(
    [...versionsByName.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()]),
  );
}

export function parseBulkAdvisories(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("npm Bulk Advisory response must be an object");
  }

  const advisories = [];
  for (const [packageName, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) throw new Error(`npm advisories for ${packageName} must be an array`);
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") throw new Error(`npm advisory for ${packageName} must be an object`);
      const { id, severity, title, url, vulnerable_versions: vulnerableVersions } = entry;
      if ((typeof id !== "number" && typeof id !== "string")
        || typeof severity !== "string"
        || !severityRank.has(severity)
        || typeof title !== "string"
        || typeof url !== "string"
        || typeof vulnerableVersions !== "string") {
        throw new Error(`npm advisory for ${packageName} has an invalid shape`);
      }
      advisories.push({ packageName, id: String(id), severity, title, url, vulnerableVersions });
    }
  }
  return advisories;
}

export function advisoriesAtOrAbove(advisories, minimumSeverity) {
  const minimum = severityRank.get(minimumSeverity);
  if (minimum === undefined) throw new Error(`Unsupported audit severity: ${minimumSeverity}`);
  return advisories.filter(({ severity }) => (severityRank.get(severity) ?? -1) >= minimum);
}

async function requestBulkAdvisories(payload) {
  const endpoint = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`npm Bulk Advisory endpoint returned HTTP ${response.status}`);
      return parseBulkAdvisories(await response.json());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const packages = collectLockedPackageVersions(lock);
  const advisories = await requestBulkAdvisories(packages);
  const blocking = advisoriesAtOrAbove(advisories, "low");
  const packageVersionCount = Object.values(packages).reduce((total, versions) => total + versions.length, 0);

  if (blocking.length > 0) {
    console.error("npm dependency audit failed:");
    for (const advisory of blocking) {
      console.error(`- [${advisory.severity}] ${advisory.packageName}: ${advisory.title} (${advisory.url})`);
    }
    process.exit(1);
  }
  console.log(`npm dependency audit passed: ${packageVersionCount} locked package versions checked through the Bulk Advisory endpoint; no low-or-higher advisories found.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
