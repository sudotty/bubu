import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export const RELEASE_TARGETS = Object.freeze([
  Object.freeze({ platform: "darwin", arch: "arm64", id: "macos-arm64" }),
  Object.freeze({ platform: "darwin", arch: "x64", id: "macos-x64" }),
  Object.freeze({ platform: "win32", arch: "x64", id: "windows-x64" }),
]);

export function resolveReleaseTarget(platform, arch) {
  const target = RELEASE_TARGETS.find((value) => value.platform === platform && value.arch === arch);
  if (!target) throw new Error(`Unsupported stable release target: ${platform}-${arch}`);
  return target;
}

export function releaseAssetName(version, platform, arch, kind, sourceName = "") {
  const { id } = resolveReleaseTarget(platform, arch);
  const prefix = `BuBu-${version}-${id}`;
  if (kind === "dmg") return `${prefix}.dmg`;
  if (kind === "zip") return `${prefix}.zip`;
  if (kind === "setup") return `${prefix}-Setup.exe`;
  if (kind === "releases") return `${prefix}-RELEASES`;
  if (kind === "nupkg") {
    const suffix = sourceName.toLowerCase().endsWith("-delta.nupkg") ? "delta.nupkg" : "full.nupkg";
    return `${prefix}-${suffix}`;
  }
  if (kind === "smoke") return `${prefix}-installer-smoke.json`;
  throw new Error(`Unsupported release artifact kind: ${kind}`);
}

export function classifyMakeArtifact(platform, path) {
  const name = basename(path);
  if (platform === "darwin" && name.toLowerCase().endsWith(".dmg")) return "dmg";
  if (platform === "darwin" && name.toLowerCase().endsWith(".zip")) return "zip";
  if (platform === "win32" && name.toLowerCase().endsWith("-setup.exe")) return "setup";
  if (platform === "win32" && name.toLowerCase().endsWith(".nupkg")) return "nupkg";
  if (platform === "win32" && name === "RELEASES") return "releases";
  return undefined;
}

export function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function checksumLines(artifacts) {
  return [...artifacts]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((artifact) => `${artifact.sha256}  ${artifact.name}`)
    .join("\n");
}
