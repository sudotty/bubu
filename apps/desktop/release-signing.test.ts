import { describe, expect, it } from "vitest";
import { resolveMacSigning, resolveWindowsSigning } from "./release-signing.js";

describe("release signing configuration", () => {
  it("keeps unsigned local builds explicit", () => {
    expect(resolveMacSigning({})).toEqual({});
    expect(resolveWindowsSigning({})).toBeUndefined();
  });

  it("fails closed on partial macOS credentials", () => {
    expect(() => resolveMacSigning({ BUBU_MAC_SIGN_IDENTITY: "Developer ID Application: BuBu" })).toThrow(/BUBU_APPLE_API_KEY_PATH/u);
  });

  it("uses App Store Connect API keys for notarization", () => {
    expect(resolveMacSigning({
      BUBU_MAC_SIGN_IDENTITY: "Developer ID Application: BuBu",
      BUBU_APPLE_API_KEY_PATH: "/tmp/AuthKey.p8",
      BUBU_APPLE_API_KEY_ID: "ABCDEFGHIJ",
      BUBU_APPLE_API_ISSUER: "00000000-0000-0000-0000-000000000000",
    })).toMatchObject({ osxNotarize: { appleApiKeyId: "ABCDEFGHIJ" } });
  });

  it("builds the official Azure Artifact Signing arguments", () => {
    expect(resolveWindowsSigning({
      BUBU_WINDOWS_SIGN_BACKEND: "azure",
      BUBU_WINDOWS_SIGNTOOL_PATH: "C:\\signtool.exe",
      BUBU_AZURE_SIGNING_DLIB_PATH: "C:\\Azure.CodeSigning.Dlib.dll",
      BUBU_AZURE_SIGNING_METADATA_PATH: "C:\\metadata.json",
      AZURE_CLIENT_ID: "client",
      AZURE_TENANT_ID: "tenant",
      AZURE_FEDERATED_TOKEN_FILE: "C:\\token",
    })).toMatchObject({ hashes: ["sha256"], timestampServer: "http://timestamp.acs.microsoft.com" });
  });

  it("leaves signing to the official Azure GitHub Action when selected", () => {
    expect(resolveWindowsSigning({ BUBU_WINDOWS_SIGN_BACKEND: "azure-action" })).toBeUndefined();
  });

  it("rejects unknown or partially configured Windows backends", () => {
    expect(() => resolveWindowsSigning({ BUBU_WINDOWS_SIGNTOOL_PATH: "signtool.exe" })).toThrow(/BUBU_WINDOWS_SIGN_BACKEND/u);
    expect(() => resolveWindowsSigning({ BUBU_WINDOWS_SIGN_BACKEND: "pfx" })).toThrow(/Unsupported/u);
  });
});
