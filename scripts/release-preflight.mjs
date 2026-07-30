import { isAzureArtifactSigningEndpoint, isExactGuid } from "./release-environment-config.mjs";

const macSigningVariables = [
  "BUBU_MAC_SIGN_IDENTITY",
  "BUBU_APPLE_API_KEY_PATH",
  "BUBU_APPLE_API_KEY_ID",
  "BUBU_APPLE_API_ISSUER",
];

const windowsAzureActionVariables = [
  "BUBU_WINDOWS_SIGN_BACKEND",
  "BUBU_AZURE_CLIENT_ID",
  "BUBU_AZURE_TENANT_ID",
  "BUBU_AZURE_SUBSCRIPTION_ID",
  "BUBU_AZURE_SIGNING_ENDPOINT",
  "BUBU_AZURE_SIGNING_ACCOUNT",
  "BUBU_AZURE_SIGNING_PROFILE",
];

const windowsAzureDlibVariables = [
  "BUBU_WINDOWS_SIGN_BACKEND",
  "BUBU_WINDOWS_SIGNTOOL_PATH",
  "BUBU_AZURE_SIGNING_DLIB_PATH",
  "BUBU_AZURE_SIGNING_METADATA_PATH",
  "AZURE_CLIENT_ID",
  "AZURE_TENANT_ID",
];

const windowsCloudHsmVariables = [
  "BUBU_WINDOWS_SIGN_BACKEND",
  "BUBU_WINDOWS_SIGNTOOL_PATH",
  "BUBU_WINDOWS_SIGN_PARAMS",
];

const present = (env, name) => Boolean(env[name]?.trim());

export function releasePreflightRequirements(platform, env) {
  if (platform === "darwin") {
    return { required: macSigningVariables, alternatives: [] };
  }
  if (platform !== "win32") {
    throw new Error("Public beta preflight requires --platform=darwin or --platform=win32");
  }

  const backend = env.BUBU_WINDOWS_SIGN_BACKEND?.trim();
  if (backend === "azure-action") {
    return { required: windowsAzureActionVariables, alternatives: [] };
  }
  if (backend === "azure") {
    return {
      required: windowsAzureDlibVariables,
      alternatives: [["AZURE_CLIENT_SECRET", "AZURE_FEDERATED_TOKEN_FILE"]],
    };
  }
  if (backend === "cloud-hsm") {
    return { required: windowsCloudHsmVariables, alternatives: [] };
  }
  if (!backend) {
    return { required: ["BUBU_WINDOWS_SIGN_BACKEND"], alternatives: [] };
  }
  throw new Error(`Unsupported Windows signing backend: ${backend}`);
}

export function missingReleasePreflightEnvironment(platform, env) {
  const { required, alternatives } = releasePreflightRequirements(platform, env);
  const missing = required.filter((name) => !present(env, name));
  for (const names of alternatives) {
    if (!names.some((name) => present(env, name))) {
      missing.push(names.join(" or "));
    }
  }
  return missing;
}

export function invalidReleasePreflightEnvironment(platform, env) {
  releasePreflightRequirements(platform, env);
  const invalid = [];
  const validateGuid = (name) => {
    if (present(env, name) && !isExactGuid(env[name])) invalid.push(`${name} must be a UUID`);
  };
  if (platform === "darwin") {
    if (present(env, "BUBU_MAC_SIGN_IDENTITY") && !env.BUBU_MAC_SIGN_IDENTITY.trim().startsWith("Developer ID Application:")) {
      invalid.push("BUBU_MAC_SIGN_IDENTITY must name a Developer ID Application identity");
    }
    if (present(env, "BUBU_APPLE_API_KEY_ID") && !/^[A-Z0-9]{10}$/u.test(env.BUBU_APPLE_API_KEY_ID.trim())) {
      invalid.push("BUBU_APPLE_API_KEY_ID must be a 10-character App Store Connect key ID");
    }
    validateGuid("BUBU_APPLE_API_ISSUER");
    return invalid;
  }

  const backend = env.BUBU_WINDOWS_SIGN_BACKEND?.trim();
  if (backend === "azure-action") {
    validateGuid("BUBU_AZURE_CLIENT_ID");
    validateGuid("BUBU_AZURE_TENANT_ID");
    validateGuid("BUBU_AZURE_SUBSCRIPTION_ID");
    if (present(env, "BUBU_AZURE_SIGNING_ENDPOINT") && !isAzureArtifactSigningEndpoint(env.BUBU_AZURE_SIGNING_ENDPOINT)) {
      invalid.push("BUBU_AZURE_SIGNING_ENDPOINT must be an HTTPS Azure Artifact Signing endpoint");
    }
  } else if (backend === "azure") {
    validateGuid("AZURE_CLIENT_ID");
    validateGuid("AZURE_TENANT_ID");
  }
  return invalid;
}
