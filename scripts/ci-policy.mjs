import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const nativePrefixes = Object.freeze([
  ".github/workflows/package-smoke.yml",
  ".github/workflows/preview-release.yml",
  ".github/workflows/release.yml",
  "apps/desktop/",
  "packages/contracts/",
  "packages/product-core/",
  "services/ai-runtime/",
  "services/data-core/",
  "services/hub/",
]);
const nativeFiles = new Set([
  "package.json",
  "package-lock.json",
  ".nvmrc",
  "scripts/build-data-core.mjs",
  "scripts/ci-policy.mjs",
  "scripts/finalize-release-assets.mjs",
  "scripts/generate-go-sbom.mjs",
  "scripts/native-installer-policy.mjs",
  "scripts/native-signature-verifier.mjs",
  "scripts/platform-paths.mjs",
  "scripts/prepare-electron-runtime.mjs",
  "scripts/release-artifacts.mjs",
  "scripts/release-policy.mjs",
  "scripts/resolve-previous-release.mjs",
  "scripts/smoke-native-installer.mjs",
  "scripts/smoke-packaged-desktop.mjs",
  "scripts/stage-release-assets.mjs",
  "scripts/sync-release-assets.mjs",
  "scripts/verify-release-ref.mjs",
]);

export function requiresNativePackage(paths) {
  return paths.some((path) => nativeFiles.has(path) || nativePrefixes.some((prefix) => (
    prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix
  )));
}

export function assertPullRequestTitle(title) {
  if (!/^(?:feat|fix|refactor|perf|test|docs|build|ci|chore|revert)(?:\([a-z0-9][a-z0-9-]*\))?!?: .{3,100}$/u.test(title ?? "")) {
    throw new Error("Pull-request title must use type(scope): outcome and be suitable for the squash commit");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  if (process.argv.includes("--changed-files")) {
    const paths = readFileSync(0, "utf8").split(/\r?\n/u).filter(Boolean);
    const value = requiresNativePackage(paths) ? "true" : "false";
    if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
    appendFileSync(process.env.GITHUB_OUTPUT, `native=${value}\n`);
    console.log(`Native package contract required: ${value}`);
  } else if (process.argv.includes("--pull-request-title")) {
    assertPullRequestTitle(process.env.BUBU_PR_TITLE);
    console.log("Pull-request title is suitable for the squash history.");
  } else {
    throw new Error("Usage: ci-policy --changed-files | --pull-request-title");
  }
}
