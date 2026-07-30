import { extname } from "node:path";

export function assertNativeInstaller(targetPlatform, artifactPath) {
  const extension = extname(artifactPath).toLowerCase();
  if (targetPlatform === "darwin" && extension !== ".dmg") throw new Error("macOS installer smoke requires a DMG");
  if (targetPlatform === "win32" && extension !== ".exe") throw new Error("Windows installer smoke requires a Setup.exe");
  if (!['darwin', 'win32'].includes(targetPlatform)) throw new Error(`Native installer smoke is unsupported on ${targetPlatform}`);
}

export function lifecycleSteps(hasPreviousArtifact) {
  return [
    "install",
    "launch-import-task-backup-restore",
    hasPreviousArtifact ? "upgrade" : "upgrade-skipped-no-previous-artifact",
    "uninstall",
  ];
}

export function packagedSmokeTimeoutMs(targetPlatform) {
  // A cold Squirrel launch on a hosted Windows runner includes first-run
  // extraction and process startup before the full product smoke can begin.
  // The smoke also exercises every completed packaged journey, including the
  // exact-row disclosure approval, audited model round trip, remote-profile
  // review, external-delivery binding, optional encrypted Hub setup, demo
  // import, merge, and reconciliation. Each journey keeps its own tighter
  // deadline; this outer budget only accommodates slower hosted cold starts.
  return targetPlatform === "win32" ? 120_000 : 60_000;
}

export function assertDistinctUpgrade(currentPath, previousPath, currentDigest, previousDigest) {
  if (currentPath === previousPath || currentDigest === previousDigest) {
    throw new Error("Upgrade evidence requires a distinct previous release artifact");
  }
}
