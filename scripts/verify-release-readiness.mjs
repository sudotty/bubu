import { readFileSync } from "node:fs";
import { invalidReleasePreflightEnvironment, missingReleasePreflightEnvironment } from "./release-preflight.mjs";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = loadProductManifest(new URL("..", import.meta.url));
const forge = read("apps/desktop/forge.config.ts");
const readiness = read("docs/release/public-beta-readiness.md");
const support = read("docs/release/platform-support.md");
const packageWorkflow = read(".github/workflows/package-smoke.yml");
const releaseWorkflow = read(".github/workflows/release.yml");
const environmentConfigurator = read("scripts/configure-release-environment.mjs");
const externalEvidenceGate = read("scripts/verify-external-evidence.mjs");
const pilotPlan = read("docs/release/design-partner-pilot.md");
const failures = [];
for (const value of ["asar: true", "EnableEmbeddedAsarIntegrityValidation", "OnlyLoadAppFromAsar", "resolveMacSigning", "resolveWindowsSigning", "windowsSign"]) if (!forge.includes(value)) failures.push(`desktop packaging missing ${value}`);
requireManifestFacts(manifest, ["signed-installers: planned", "native-package-matrix-ci: implemented", "draft-github-release-pipeline: implemented", "release-checksums: implemented", "cyclonedx-release-sbom: implemented", "complete-release-signing-preflight: implemented", "secure-release-environment-bootstrap: implemented"], failures, "release manifest");
for (const value of ["signed-artifacts", "clean-install-upgrade-restore", "legacy-migration-disposition"]) if (!manifest.releaseGates.includes(value)) failures.push(`manifest release gate missing ${value}`);
for (const value of ["BLOCKED ON EXTERNAL EVIDENCE", "Developer ID identity", "release:configure-environment", "signed update discovery", "clean-device", "legacy Wails runtime", "release runbook"]) if (!readiness.includes(value)) failures.push(`release readiness document missing ${value}`);
for (const value of ["Remaining sellable-V1 pilot evidence", "5–10 person design-partner pilot", "two real business periods", "paid pilot", "zero unapproved data disclosures"]) if (!readiness.includes(value)) failures.push(`sellable V1 evidence gate missing ${value}`);
for (const value of ["macOS 13+ arm64", "macOS 13+ x64", "Windows 10 22H2", "Windows 11 arm64", "Squirrel", "v<package.json version>"]) if (!support.includes(value)) failures.push(`platform support document missing ${value}`);
for (const value of ["macos-15", "macos-15-intel", "windows-2025", "smoke-native-installer.mjs"]) if (!packageWorkflow.includes(value)) failures.push(`native package workflow missing ${value}`);
for (const value of ["Azure/artifact-signing-action@", "notarytool submit", "npm sbom", "attest-build-provenance@", "BUBU_AZURE_SUBSCRIPTION_ID", "sync-release-assets.mjs", "--channel=stable"]) if (!releaseWorkflow.includes(value)) failures.push(`signed release workflow missing ${value}`);
for (const value of ["input: write.value", "env: childEnvironment", "--repository=", "--apply", "--enable-attestations"]) if (!environmentConfigurator.includes(value)) failures.push(`release environment configurator missing ${value}`);
for (const value of ["BUBU_PUBLIC_BETA_EVIDENCE_PATH", "BUBU_PILOT_EVIDENCE_PATH", "validatePublicBetaEvidence", "validatePilotEvidence"]) if (!externalEvidenceGate.includes(value)) failures.push(`external evidence gate missing ${value}`);
for (const value of ["READY TO RUN; NOT YET EVIDENCE-COMPLETE", "explicit written consent", "zero safety violations", "verify:pilot-evidence"]) if (!pilotPlan.includes(value)) failures.push(`design-partner pilot plan missing ${value}`);
if (failures.length) {
  console.error(`Release readiness verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

const requirePublicBeta = process.argv.includes("--require-public-beta");
const requestedPlatform = process.argv.find((value) => value.startsWith("--platform="))?.slice("--platform=".length);
if (!requirePublicBeta) {
  console.log("Release contract verified; public beta remains blocked without signing/notarization credentials and external evidence.");
  process.exit(0);
}

try {
  const missingEnvironment = missingReleasePreflightEnvironment(requestedPlatform, process.env);
  const invalidEnvironment = invalidReleasePreflightEnvironment(requestedPlatform, process.env);
  if (missingEnvironment.length > 0 || invalidEnvironment.length > 0) {
    const problems = [];
    if (missingEnvironment.length > 0) problems.push(`missing ${missingEnvironment.join(", ")}`);
    if (invalidEnvironment.length > 0) problems.push(`invalid ${invalidEnvironment.join(", ")}`);
    console.error(`Public beta preflight is blocked: ${problems.join("; ")}`);
    process.exit(1);
  }
  console.log("Release contract and signing environment verified; external signed-artifact and clean-device evidence are still required.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
