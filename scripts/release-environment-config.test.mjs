import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReleaseEnvironmentPlan,
  githubSetArguments,
  releaseChildEnvironment,
  repositoryFromRemoteUrl,
  validateRepositoryName,
} from "./release-environment-config.mjs";

const completeEnvironment = () => ({
  BUBU_MAC_CERTIFICATE_P12_BASE64: Buffer.from([0x30, 0x82, 0x01, 0x00]).toString("base64"),
  BUBU_MAC_CERTIFICATE_PASSWORD: "local-test-password",
  BUBU_MAC_SIGN_IDENTITY: "Developer ID Application: Example Company (A1B2C3D4E5)",
  BUBU_APPLE_API_KEY_P8_BASE64: Buffer.from("-----BEGIN PRIVATE KEY-----\ntest-only\n-----END PRIVATE KEY-----\n").toString("base64"),
  BUBU_APPLE_API_KEY_ID: "A1B2C3D4E5",
  BUBU_APPLE_API_ISSUER: "11111111-2222-4333-8444-555555555555",
  BUBU_AZURE_CLIENT_ID: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  BUBU_AZURE_TENANT_ID: "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff",
  BUBU_AZURE_SUBSCRIPTION_ID: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111",
  BUBU_AZURE_SIGNING_ENDPOINT: "https://example.codesigning.azure.net",
  BUBU_AZURE_SIGNING_ACCOUNT: "example-account",
  BUBU_AZURE_SIGNING_PROFILE: "example-profile",
});

test("builds a complete release-environment plan without requiring optional attestations", () => {
  const plan = buildReleaseEnvironmentPlan(completeEnvironment());
  assert.deepEqual(plan.missingNames, []);
  assert.deepEqual(plan.validationErrors, []);
  assert.equal(plan.writes.filter(({ kind }) => kind === "secret").length, 6);
  assert.equal(plan.writes.filter(({ kind }) => kind === "variable").length, 7);
  assert.deepEqual(plan.writes.find(({ name }) => name === "BUBU_ENABLE_ARTIFACT_ATTESTATIONS"), {
    kind: "variable", name: "BUBU_ENABLE_ARTIFACT_ATTESTATIONS", value: "false",
  });
});

test("reports every absent or malformed value before any external write", () => {
  const environment = completeEnvironment();
  delete environment.BUBU_MAC_CERTIFICATE_PASSWORD;
  environment.BUBU_MAC_SIGN_IDENTITY = "ad-hoc";
  environment.BUBU_AZURE_SIGNING_ENDPOINT = "http://example.invalid";
  const plan = buildReleaseEnvironmentPlan(environment);
  assert.deepEqual(plan.missingNames, ["BUBU_MAC_CERTIFICATE_PASSWORD"]);
  assert.deepEqual(plan.validationErrors, [
    "BUBU_MAC_SIGN_IDENTITY must name a Developer ID Application identity",
    "BUBU_AZURE_SIGNING_ENDPOINT must be an HTTPS Azure Artifact Signing endpoint",
  ]);
});

test("passes values over standard input rather than process arguments", () => {
  assert.deepEqual(githubSetArguments("secret", "BUBU_MAC_CERTIFICATE_PASSWORD", "sudotty/bubu"), [
    "secret", "set", "BUBU_MAC_CERTIFICATE_PASSWORD", "--env", "release", "--repo", "sudotty/bubu",
  ]);
  assert.deepEqual(githubSetArguments("variable", "BUBU_AZURE_CLIENT_ID", "sudotty/bubu"), [
    "variable", "set", "BUBU_AZURE_CLIENT_ID", "--env", "release", "--repo", "sudotty/bubu",
  ]);
});

test("requires an exact owner/repository target", () => {
  assert.equal(validateRepositoryName("sudotty/bubu"), "sudotty/bubu");
  for (const value of ["", "bubu", "origin", "https://github.com/sudotty/bubu", "owner/repo/extra"]) {
    assert.throws(() => validateRepositoryName(value), /owner\/repository/u);
  }
});

test("binds publisher configuration to the current GitHub origin", () => {
  assert.equal(repositoryFromRemoteUrl("https://github.com/sudotty/bubu.git"), "sudotty/bubu");
  assert.equal(repositoryFromRemoteUrl("git@github.com:sudotty/bubu.git"), "sudotty/bubu");
  assert.equal(repositoryFromRemoteUrl("https://example.com/sudotty/bubu.git"), undefined);
});

test("removes every release value from the GitHub CLI child environment", () => {
  const environment = {
    ...completeEnvironment(),
    BUBU_ENABLE_ARTIFACT_ATTESTATIONS: "false",
    GH_TOKEN: "test-token-not-a-real-credential",
    PATH: "/usr/bin",
  };
  const child = releaseChildEnvironment(environment);
  assert.equal(child.GH_TOKEN, environment.GH_TOKEN);
  assert.equal(child.PATH, environment.PATH);
  for (const name of Object.keys(environment).filter((name) => name.startsWith("BUBU_"))) {
    assert.equal(name in child, false, `${name} leaked to the GitHub CLI environment`);
  }
});
