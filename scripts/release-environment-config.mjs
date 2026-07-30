export const releaseSecretNames = Object.freeze([
  "BUBU_MAC_CERTIFICATE_P12_BASE64",
  "BUBU_MAC_CERTIFICATE_PASSWORD",
  "BUBU_MAC_SIGN_IDENTITY",
  "BUBU_APPLE_API_KEY_P8_BASE64",
  "BUBU_APPLE_API_KEY_ID",
  "BUBU_APPLE_API_ISSUER",
]);

export const releaseVariableNames = Object.freeze([
  "BUBU_AZURE_CLIENT_ID",
  "BUBU_AZURE_TENANT_ID",
  "BUBU_AZURE_SUBSCRIPTION_ID",
  "BUBU_AZURE_SIGNING_ENDPOINT",
  "BUBU_AZURE_SIGNING_ACCOUNT",
  "BUBU_AZURE_SIGNING_PROFILE",
]);

export const optionalReleaseVariableNames = Object.freeze([
  "BUBU_ENABLE_ARTIFACT_ATTESTATIONS",
]);

const allNames = new Set([
  ...releaseSecretNames,
  ...releaseVariableNames,
  ...optionalReleaseVariableNames,
]);

const exactGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const isExactGuid = (value) => exactGuid.test(value.trim());

export function isAzureArtifactSigningEndpoint(value) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase().endsWith(".codesigning.azure.net");
  } catch {
    return false;
  }
}

function environmentValue(environment, name) {
  const value = environment[name];
  return typeof value === "string" ? value : "";
}

function decodeStrictBase64(value) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(normalized)) {
    return undefined;
  }
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== normalized) return undefined;
  return decoded;
}

function releaseValueErrors(environment) {
  const errors = [];
  const encodedCertificate = environmentValue(environment, "BUBU_MAC_CERTIFICATE_P12_BASE64").trim();
  if (encodedCertificate !== "") {
    const certificate = decodeStrictBase64(encodedCertificate);
    if (!certificate || certificate[0] !== 0x30) {
      errors.push("BUBU_MAC_CERTIFICATE_P12_BASE64 must contain a DER PKCS#12 payload");
    }
  }
  const encodedAppleKey = environmentValue(environment, "BUBU_APPLE_API_KEY_P8_BASE64").trim();
  if (encodedAppleKey !== "") {
    const appleKey = decodeStrictBase64(encodedAppleKey);
    if (!appleKey || !appleKey.toString("utf8").includes("-----BEGIN PRIVATE KEY-----")) {
      errors.push("BUBU_APPLE_API_KEY_P8_BASE64 must contain an App Store Connect private key");
    }
  }
  const signingIdentity = environmentValue(environment, "BUBU_MAC_SIGN_IDENTITY").trim();
  if (signingIdentity !== "" && !signingIdentity.startsWith("Developer ID Application:")) {
    errors.push("BUBU_MAC_SIGN_IDENTITY must name a Developer ID Application identity");
  }
  const appleKeyID = environmentValue(environment, "BUBU_APPLE_API_KEY_ID").trim();
  if (appleKeyID !== "" && !/^[A-Z0-9]{10}$/u.test(appleKeyID)) {
    errors.push("BUBU_APPLE_API_KEY_ID must be a 10-character App Store Connect key ID");
  }
  const appleIssuer = environmentValue(environment, "BUBU_APPLE_API_ISSUER").trim();
  if (appleIssuer !== "" && !isExactGuid(appleIssuer)) {
    errors.push("BUBU_APPLE_API_ISSUER must be a UUID");
  }
  for (const name of ["BUBU_AZURE_CLIENT_ID", "BUBU_AZURE_TENANT_ID", "BUBU_AZURE_SUBSCRIPTION_ID"]) {
    const value = environmentValue(environment, name).trim();
    if (value !== "" && !isExactGuid(value)) errors.push(`${name} must be a UUID`);
  }
  const endpoint = environmentValue(environment, "BUBU_AZURE_SIGNING_ENDPOINT").trim();
  if (endpoint !== "" && !isAzureArtifactSigningEndpoint(endpoint)) {
    errors.push("BUBU_AZURE_SIGNING_ENDPOINT must be an HTTPS Azure Artifact Signing endpoint");
  }
  const attestations = environmentValue(environment, "BUBU_ENABLE_ARTIFACT_ATTESTATIONS").trim();
  if (attestations !== "" && attestations !== "true" && attestations !== "false") {
    errors.push("BUBU_ENABLE_ARTIFACT_ATTESTATIONS must be true, false, or omitted");
  }
  return errors;
}

export function buildReleaseEnvironmentPlan(environment) {
  const requiredNames = [...releaseSecretNames, ...releaseVariableNames];
  const missingNames = requiredNames.filter((name) => environmentValue(environment, name).trim() === "");
  const validationErrors = releaseValueErrors(environment);
  const writes = [];
  for (const name of releaseSecretNames) {
    const value = environmentValue(environment, name);
    if (value.trim() !== "") writes.push({ kind: "secret", name, value });
  }
  for (const name of releaseVariableNames) {
    const value = environmentValue(environment, name);
    if (value.trim() !== "") writes.push({ kind: "variable", name, value: value.trim() });
  }
  const attestations = environmentValue(environment, "BUBU_ENABLE_ARTIFACT_ATTESTATIONS").trim() || "false";
  writes.push({ kind: "variable", name: "BUBU_ENABLE_ARTIFACT_ATTESTATIONS", value: attestations });
  return { missingNames, validationErrors, writes };
}

export function repositoryFromRemoteUrl(value) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/u.exec(value?.trim() ?? "");
  return match?.[1].replace(/\.git$/u, "");
}

export function validateRepositoryName(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(value ?? "")) {
    throw new Error("repository must use the exact owner/repository form");
  }
  return value;
}

export function githubSetArguments(kind, name, repository) {
  if (kind !== "secret" && kind !== "variable") throw new Error(`unsupported release value kind: ${kind}`);
  if (!allNames.has(name)) throw new Error(`unsupported release environment value: ${name}`);
  return [kind, "set", name, "--env", "release", "--repo", validateRepositoryName(repository)];
}

export function releaseChildEnvironment(environment) {
  const result = { ...environment };
  for (const name of allNames) delete result[name];
  return result;
}
