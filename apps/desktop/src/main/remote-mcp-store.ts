import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  parseDatasetId,
  parseRemoteMcpConnectionConfigurationInput,
  parseRemoteMcpConnectionProfile,
  parseRemoteMcpRegistryState,
  type RemoteMcpConnectionConfigurationInput,
  type RemoteMcpConnectionProfile,
  type RemoteMcpRegistryState,
} from "@bubu/contracts";
import type { CredentialCipher } from "./provider-store.js";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";

const maximumConnections = 20;
interface OAuthTokens { readonly accessToken: string; readonly refreshToken?: string; readonly expiresAt?: string; readonly tokenType: "Bearer" }
interface RecordEnvelope { readonly version: 1; readonly configuration: RemoteMcpConnectionConfigurationInput & { readonly id: string }; readonly encryptedTokens: string | null }
export interface ResolvedRemoteMcpConnection { readonly profile: RemoteMcpConnectionProfile; readonly accessToken?: string; readonly refreshToken?: string }

export interface RemoteMcpStore {
  state(): RemoteMcpRegistryState;
  save(value: unknown): RemoteMcpRegistryState;
  remove(id: string): RemoteMcpRegistryState;
  resolve(id: string): ResolvedRemoteMcpConnection;
  oauthCredentials(id: string): ResolvedRemoteMcpConnection;
  saveTokens(id: string, tokens: OAuthTokens): RemoteMcpRegistryState;
  revokeTokens(id: string): RemoteMcpRegistryState;
}

function parseTokens(value: unknown): OAuthTokens {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Remote MCP OAuth tokens are invalid");
  const record = value as Record<string, unknown>;
  if (record.tokenType !== "Bearer" || typeof record.accessToken !== "string" || record.accessToken.length < 1 || record.accessToken.length > 16_384 || /[\0\r\n]/u.test(record.accessToken)) throw new Error("Remote MCP OAuth access token is invalid");
  if (record.refreshToken !== undefined && (typeof record.refreshToken !== "string" || record.refreshToken.length < 1 || record.refreshToken.length > 16_384 || /[\0\r\n]/u.test(record.refreshToken))) throw new Error("Remote MCP OAuth refresh token is invalid");
  if (record.expiresAt !== undefined && (typeof record.expiresAt !== "string" || !Number.isFinite(Date.parse(record.expiresAt)))) throw new Error("Remote MCP OAuth expiry is invalid");
  return { accessToken: record.accessToken, tokenType: "Bearer", ...(record.refreshToken === undefined ? {} : { refreshToken: record.refreshToken }), ...(record.expiresAt === undefined ? {} : { expiresAt: record.expiresAt }) };
}

export function createRemoteMcpStore(options: { readonly directory: string; readonly cipher: CredentialCipher; readonly createId?: () => string; readonly now?: () => number }): RemoteMcpStore {
  preparePrivateDirectory(options.directory);
  const records = new Map<string, RecordEnvelope>();
  for (const file of readdirSync(options.directory).sort()) {
    if (!file.endsWith(".json")) throw new Error("Remote MCP directory contains an unknown file");
    const id = parseDatasetId(file.slice(0, -5));
    const raw = JSON.parse(readFileSync(join(options.directory, file), "utf8")) as Record<string, unknown>;
    if (raw.version !== 1 || typeof raw.encryptedTokens !== "string" && raw.encryptedTokens !== null) throw new Error("Remote MCP record is invalid");
    const configuration = parseRemoteMcpConnectionConfigurationInput(raw.configuration) as RecordEnvelope["configuration"];
    if (configuration.id !== id) throw new Error("Remote MCP record identifier is inconsistent");
    records.set(id, { version: 1, configuration, encryptedTokens: raw.encryptedTokens as string | null });
  }
  const pathFor = (id: string) => join(options.directory, `${id}.json`);
  const tokensFor = (record: RecordEnvelope): OAuthTokens | undefined => record.encryptedTokens === null ? undefined : parseTokens(JSON.parse(options.cipher.decrypt(Buffer.from(record.encryptedTokens, "base64"))) as unknown);
  const profileFor = (record: RecordEnvelope): RemoteMcpConnectionProfile => {
    const tokens = tokensFor(record);
    const status = record.configuration.authorization.kind === "none" ? "not-required" : tokens === undefined ? "disconnected" : tokens.expiresAt !== undefined && Date.parse(tokens.expiresAt) <= (options.now?.() ?? Date.now()) ? "expired" : "connected";
    return parseRemoteMcpConnectionProfile({ ...record.configuration, authorizationStatus: status });
  };
  const state = () => parseRemoteMcpRegistryState({ connections: [...records.values()].map(profileFor), encryptionAvailable: options.cipher.isEncryptionAvailable() });
  const persist = (record: RecordEnvelope) => { atomicPrivateWrite(pathFor(record.configuration.id), `${JSON.stringify(record, null, 2)}\n`); records.set(record.configuration.id, record); };
  return {
    state,
    save(value) {
      const input = parseRemoteMcpConnectionConfigurationInput(value);
      const id = input.id ?? parseDatasetId(options.createId?.() ?? randomBytes(16).toString("hex"));
      const existing = records.get(id);
      if (input.id !== undefined && !existing) throw new Error("Remote MCP connection does not exist");
      if (!existing && records.size >= maximumConnections) throw new Error("Remote MCP connection registry is full");
      const configuration = { ...input, id };
      const unchangedOAuth = existing !== undefined && JSON.stringify(existing.configuration.authorization) === JSON.stringify(configuration.authorization) && existing.configuration.serverUrl === configuration.serverUrl;
      persist({ version: 1, configuration, encryptedTokens: unchangedOAuth ? existing.encryptedTokens : null });
      return state();
    },
    remove(value) { const id = parseDatasetId(value); if (!records.delete(id)) throw new Error("Remote MCP connection does not exist"); rmSync(pathFor(id), { force: true }); return state(); },
    resolve(value) {
      const id = parseDatasetId(value); const record = records.get(id); if (!record || !existsSync(pathFor(id))) throw new Error("Remote MCP connection does not exist");
      const profile = profileFor(record); const tokens = tokensFor(record);
      if (profile.authorization.kind === "oauth-pkce" && profile.authorizationStatus !== "connected") throw new Error("Remote MCP OAuth authorization is required or expired");
      return { profile, ...(tokens === undefined ? {} : { accessToken: tokens.accessToken, ...(tokens.refreshToken === undefined ? {} : { refreshToken: tokens.refreshToken }) }) };
    },
    oauthCredentials(value) {
      const id = parseDatasetId(value); const record = records.get(id); if (!record || record.configuration.authorization.kind !== "oauth-pkce") throw new Error("Remote MCP OAuth connection does not exist");
      const tokens = tokensFor(record); if (!tokens) throw new Error("Remote MCP OAuth authorization is required");
      return { profile: profileFor(record), accessToken: tokens.accessToken, ...(tokens.refreshToken === undefined ? {} : { refreshToken: tokens.refreshToken }) };
    },
    saveTokens(value, tokenValue) { const id = parseDatasetId(value); const record = records.get(id); if (!record || record.configuration.authorization.kind !== "oauth-pkce") throw new Error("Remote MCP OAuth connection does not exist"); if (!options.cipher.isEncryptionAvailable()) throw new Error("Credential encryption is unavailable"); const tokens = parseTokens(tokenValue); const encryptedTokens = options.cipher.encrypt(JSON.stringify(tokens)).toString("base64"); persist({ ...record, encryptedTokens }); return state(); },
    revokeTokens(value) { const id = parseDatasetId(value); const record = records.get(id); if (!record) throw new Error("Remote MCP connection does not exist"); persist({ ...record, encryptedTokens: null }); return state(); },
  };
}
