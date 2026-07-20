import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = read("PRODUCT_MANIFEST.yaml");
const forge = read("apps/desktop/forge.config.ts");
const entitlements = read("apps/desktop/resources/entitlements.mac.plist");
const readiness = read("docs/release/public-beta-readiness.md");
const failures = [];
for (const value of ["asar: true", "EnableEmbeddedAsarIntegrityValidation", "OnlyLoadAppFromAsar", "BUBU_MAC_SIGN_IDENTITY", "BUBU_APPLE_APP_PASSWORD", "osxSign", "osxNotarize"]) if (!forge.includes(value)) failures.push(`desktop packaging missing ${value}`);
for (const value of ["com.apple.security.cs.allow-jit", "com.apple.security.cs.allow-unsigned-executable-memory"]) if (!entitlements.includes(value)) failures.push(`macOS entitlements missing ${value}`);
for (const value of ["signed-installers: planned", "signed-artifacts", "clean-install-upgrade-restore", "legacy-migration-disposition"]) if (!manifest.includes(value)) failures.push(`manifest release truth missing ${value}`);
for (const value of ["BLOCKED", "signed and notarized macOS artifact", "signed update metadata", "clean-device", "bubu-bi"]) if (!readiness.includes(value)) failures.push(`release readiness document missing ${value}`);
if (failures.length) {
  console.error(`Release readiness verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

const requirePublicBeta = process.argv.includes("--require-public-beta");
const requiredEnvironment = ["BUBU_MAC_SIGN_IDENTITY", "BUBU_APPLE_ID", "BUBU_APPLE_APP_PASSWORD", "BUBU_APPLE_TEAM_ID"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]?.trim());
if (requirePublicBeta && missingEnvironment.length) {
  console.error(`Public beta preflight is blocked: missing ${missingEnvironment.join(", ")}`);
  process.exit(1);
}
console.log(missingEnvironment.length ? "Release contract verified; public beta remains blocked without signing/notarization credentials and external evidence." : "Release contract and signing environment verified; external signed-artifact and clean-device evidence are still required.");
