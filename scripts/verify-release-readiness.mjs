import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const manifest = read("PRODUCT_MANIFEST.yaml");
const forge = read("apps/desktop/forge.config.ts");
const readiness = read("docs/release/public-beta-readiness.md");
const support = read("docs/release/platform-support.md");
const failures = [];
for (const value of ["asar: true", "EnableEmbeddedAsarIntegrityValidation", "OnlyLoadAppFromAsar", "resolveMacSigning", "resolveWindowsSigning", "windowsSign"]) if (!forge.includes(value)) failures.push(`desktop packaging missing ${value}`);
for (const value of ["signed-installers: planned", "signed-artifacts", "clean-install-upgrade-restore", "legacy-migration-disposition"]) if (!manifest.includes(value)) failures.push(`manifest release truth missing ${value}`);
for (const value of ["BLOCKED", "signed and notarized macOS artifact", "signed update metadata", "clean-device", "bubu-bi"]) if (!readiness.includes(value)) failures.push(`release readiness document missing ${value}`);
for (const value of ["macOS 13+ arm64", "macOS 13+ x64", "Windows 10 22H2", "Windows 11 arm64", "Squirrel", "v<package.json version>"]) if (!support.includes(value)) failures.push(`platform support document missing ${value}`);
if (failures.length) {
  console.error(`Release readiness verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

const requirePublicBeta = process.argv.includes("--require-public-beta");
const requestedPlatform = process.argv.find((value) => value.startsWith("--platform="))?.slice("--platform=".length);
const requiredEnvironment = requestedPlatform === "win32"
  ? ["BUBU_WINDOWS_SIGN_BACKEND", "BUBU_WINDOWS_SIGNTOOL_PATH"]
  : ["BUBU_MAC_SIGN_IDENTITY", "BUBU_APPLE_API_KEY_PATH", "BUBU_APPLE_API_KEY_ID", "BUBU_APPLE_API_ISSUER"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]?.trim());
if (requirePublicBeta && !["darwin", "win32"].includes(requestedPlatform ?? "")) {
  console.error("Public beta preflight requires --platform=darwin or --platform=win32");
  process.exit(1);
}
if (requirePublicBeta && missingEnvironment.length) {
  console.error(`Public beta preflight is blocked: missing ${missingEnvironment.join(", ")}`);
  process.exit(1);
}
console.log(missingEnvironment.length ? "Release contract verified; public beta remains blocked without signing/notarization credentials and external evidence." : "Release contract and signing environment verified; external signed-artifact and clean-device evidence are still required.");
