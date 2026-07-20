import type { WindowsSignOptions } from "@electron/packager";
import type { HASHES } from "@electron/windows-sign/dist/esm/types";

type Environment = Readonly<Record<string, string | undefined>>;

function values(env: Environment, names: readonly string[]): readonly (string | undefined)[] {
  return names.map((name) => env[name]?.trim() || undefined);
}

function completeGroup(env: Environment, names: readonly string[], label: string): readonly string[] | undefined {
  const resolved = values(env, names);
  if (resolved.every((value) => value === undefined)) return undefined;
  const missing = names.filter((_, index) => resolved[index] === undefined);
  if (missing.length > 0) throw new Error(`${label} configuration is incomplete: missing ${missing.join(", ")}`);
  return resolved as readonly string[];
}

export function resolveMacSigning(env: Environment = process.env): {
  readonly osxSign?: { readonly identity: string };
  readonly osxNotarize?: { readonly appleApiKey: string; readonly appleApiKeyId: string; readonly appleApiIssuer: string };
} {
  const group = completeGroup(env, ["BUBU_MAC_SIGN_IDENTITY", "BUBU_APPLE_API_KEY_PATH", "BUBU_APPLE_API_KEY_ID", "BUBU_APPLE_API_ISSUER"], "macOS signing");
  if (!group) return {};
  const [identity, appleApiKey, appleApiKeyId, appleApiIssuer] = group;
  if (!identity || !appleApiKey || !appleApiKeyId || !appleApiIssuer) throw new Error("macOS signing resolution failed");
  return { osxSign: { identity }, osxNotarize: { appleApiKey, appleApiKeyId, appleApiIssuer } };
}

export function resolveWindowsSigning(env: Environment = process.env): WindowsSignOptions | undefined {
  const backend = env.BUBU_WINDOWS_SIGN_BACKEND?.trim();
  const related = ["BUBU_WINDOWS_SIGNTOOL_PATH", "BUBU_WINDOWS_SIGN_PARAMS", "BUBU_AZURE_SIGNING_DLIB_PATH", "BUBU_AZURE_SIGNING_METADATA_PATH"];
  if (!backend) {
    if (values(env, related).some(Boolean)) throw new Error("Windows signing variables require BUBU_WINDOWS_SIGN_BACKEND");
    return undefined;
  }
  if (backend === "azure") {
    const group = completeGroup(env, ["BUBU_WINDOWS_SIGNTOOL_PATH", "BUBU_AZURE_SIGNING_DLIB_PATH", "BUBU_AZURE_SIGNING_METADATA_PATH", "AZURE_CLIENT_ID", "AZURE_TENANT_ID"], "Azure Artifact Signing");
    const [signToolPath, dlib, metadata] = group ?? [];
    if (!env.AZURE_CLIENT_SECRET?.trim() && !env.AZURE_FEDERATED_TOKEN_FILE?.trim()) throw new Error("Azure Artifact Signing requires a client secret or federated token");
    if (!signToolPath || !dlib || !metadata) throw new Error("Azure Artifact Signing resolution failed");
    return {
      signToolPath,
      signWithParams: ["/v", "/debug", "/dlib", dlib, "/dmdf", metadata],
      timestampServer: "http://timestamp.acs.microsoft.com",
      hashes: ["sha256" as HASHES],
    };
  }
  if (backend === "cloud-hsm") {
    const group = completeGroup(env, ["BUBU_WINDOWS_SIGNTOOL_PATH", "BUBU_WINDOWS_SIGN_PARAMS"], "cloud-HSM signing");
    const [signToolPath, signWithParams] = group ?? [];
    if (!signToolPath || !signWithParams) throw new Error("cloud-HSM signing resolution failed");
    return { signToolPath, signWithParams, hashes: ["sha256" as HASHES] };
  }
  throw new Error(`Unsupported Windows signing backend: ${backend}`);
}
