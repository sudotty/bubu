import test from "node:test";
import assert from "node:assert/strict";
import {
  invalidReleasePreflightEnvironment,
  missingReleasePreflightEnvironment,
  releasePreflightRequirements,
} from "./release-preflight.mjs";

test("requires the complete macOS signing and notarization identity", () => {
  assert.deepEqual(missingReleasePreflightEnvironment("darwin", {}), [
    "BUBU_MAC_SIGN_IDENTITY",
    "BUBU_APPLE_API_KEY_PATH",
    "BUBU_APPLE_API_KEY_ID",
    "BUBU_APPLE_API_ISSUER",
  ]);
});

test("requires every GitHub OIDC value before Azure Artifact Signing", () => {
  const env = {
    BUBU_WINDOWS_SIGN_BACKEND: "azure-action",
    BUBU_AZURE_CLIENT_ID: "client",
    BUBU_AZURE_TENANT_ID: "tenant",
  };

  assert.deepEqual(missingReleasePreflightEnvironment("win32", env), [
    "BUBU_AZURE_SUBSCRIPTION_ID",
    "BUBU_AZURE_SIGNING_ENDPOINT",
    "BUBU_AZURE_SIGNING_ACCOUNT",
    "BUBU_AZURE_SIGNING_PROFILE",
  ]);
});

test("accepts a complete Azure Action environment", () => {
  const environment = {
    BUBU_WINDOWS_SIGN_BACKEND: "azure-action",
    BUBU_AZURE_CLIENT_ID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    BUBU_AZURE_TENANT_ID: "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff",
    BUBU_AZURE_SUBSCRIPTION_ID: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111",
    BUBU_AZURE_SIGNING_ENDPOINT: "https://example.codesigning.azure.net",
    BUBU_AZURE_SIGNING_ACCOUNT: "account",
    BUBU_AZURE_SIGNING_PROFILE: "profile",
  };
  assert.deepEqual(missingReleasePreflightEnvironment("win32", environment), []);
  assert.deepEqual(invalidReleasePreflightEnvironment("win32", environment), []);
});

test("rejects malformed signing identities before a release job starts", () => {
  assert.deepEqual(invalidReleasePreflightEnvironment("darwin", {
    BUBU_MAC_SIGN_IDENTITY: "ad-hoc",
    BUBU_APPLE_API_KEY_PATH: "/tmp/AuthKey.p8",
    BUBU_APPLE_API_KEY_ID: "short",
    BUBU_APPLE_API_ISSUER: "issuer",
  }), [
    "BUBU_MAC_SIGN_IDENTITY must name a Developer ID Application identity",
    "BUBU_APPLE_API_KEY_ID must be a 10-character App Store Connect key ID",
    "BUBU_APPLE_API_ISSUER must be a UUID",
  ]);
  assert.deepEqual(invalidReleasePreflightEnvironment("win32", {
    BUBU_WINDOWS_SIGN_BACKEND: "azure-action",
    BUBU_AZURE_CLIENT_ID: "client",
    BUBU_AZURE_TENANT_ID: "tenant",
    BUBU_AZURE_SUBSCRIPTION_ID: "subscription",
    BUBU_AZURE_SIGNING_ENDPOINT: "https://example.invalid",
  }), [
    "BUBU_AZURE_CLIENT_ID must be a UUID",
    "BUBU_AZURE_TENANT_ID must be a UUID",
    "BUBU_AZURE_SUBSCRIPTION_ID must be a UUID",
    "BUBU_AZURE_SIGNING_ENDPOINT must be an HTTPS Azure Artifact Signing endpoint",
  ]);
});

test("accepts either supported Azure DLib authentication mechanism", () => {
  const base = {
    BUBU_WINDOWS_SIGN_BACKEND: "azure",
    BUBU_WINDOWS_SIGNTOOL_PATH: "signtool.exe",
    BUBU_AZURE_SIGNING_DLIB_PATH: "Azure.CodeSigning.Dlib.dll",
    BUBU_AZURE_SIGNING_METADATA_PATH: "metadata.json",
    AZURE_CLIENT_ID: "aaaaaaaa-bbbb-4ccc-8ddd-222222222222",
    AZURE_TENANT_ID: "aaaaaaaa-bbbb-4ccc-8ddd-333333333333",
  };

  assert.deepEqual(missingReleasePreflightEnvironment("win32", base), [
    "AZURE_CLIENT_SECRET or AZURE_FEDERATED_TOKEN_FILE",
  ]);
  assert.deepEqual(missingReleasePreflightEnvironment("win32", {
    ...base,
    AZURE_FEDERATED_TOKEN_FILE: "token",
  }), []);
  assert.deepEqual(invalidReleasePreflightEnvironment("win32", base), []);
});

test("rejects unsupported platforms and signing backends", () => {
  assert.throws(() => releasePreflightRequirements("linux", {}), /platform=darwin or --platform=win32/u);
  assert.throws(
    () => releasePreflightRequirements("win32", { BUBU_WINDOWS_SIGN_BACKEND: "pfx" }),
    /Unsupported Windows signing backend/u,
  );
});

test("requires the complete cloud-HSM SignTool contract", () => {
  assert.deepEqual(missingReleasePreflightEnvironment("win32", {
    BUBU_WINDOWS_SIGN_BACKEND: "cloud-hsm",
    BUBU_WINDOWS_SIGNTOOL_PATH: "signtool.exe",
  }), ["BUBU_WINDOWS_SIGN_PARAMS"]);
});
