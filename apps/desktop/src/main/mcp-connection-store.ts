import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  parseMcpConnectionConfigurationInput,
  parseMcpConnectionId,
  parseMcpConnectionProfile,
  parseMcpConnectionRegistryState,
  parseMcpResolvedEnvironment,
  type McpConnectionConfigurationInput,
  type McpConnectionId,
  type McpConnectionProfile,
  type McpConnectionRegistryState,
  type McpResolvedEnvironment,
} from "@bubu/contracts";
import type { CredentialCipher } from "./provider-store.js";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";

const maximumMcpConnections = 20;

interface McpConnectionEnvelope {
  readonly version: 1;
  readonly profile: McpConnectionProfile;
  readonly encryptedEnvironment: string | null;
}

export interface ResolvedMcpConnection {
  readonly profile: McpConnectionProfile;
  readonly environment: McpResolvedEnvironment;
}

export interface McpConnectionStore {
  state(): McpConnectionRegistryState;
  save(value: McpConnectionConfigurationInput): McpConnectionRegistryState;
  remove(value: McpConnectionId): McpConnectionRegistryState;
  resolve(value: McpConnectionId): ResolvedMcpConnection;
}

interface McpConnectionStoreOptions {
  readonly directory: string;
  readonly cipher: CredentialCipher;
  readonly createId?: () => string;
}

function parseEnvelope(value: unknown, expectedId: string): McpConnectionEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("MCP connection record is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "encryptedEnvironment,profile,version" ||
    record.version !== 1 ||
    (record.encryptedEnvironment !== null && typeof record.encryptedEnvironment !== "string")
  ) {
    throw new Error("MCP connection record is invalid");
  }
  const profile = parseMcpConnectionProfile(record.profile);
  if (profile.id !== expectedId) throw new Error("MCP connection record identifier does not match its file");
  if ((profile.transport.environmentKeys.length === 0) !== (record.encryptedEnvironment === null)) {
    throw new Error("MCP connection secret metadata is inconsistent");
  }
  return { version: 1, profile, encryptedEnvironment: record.encryptedEnvironment };
}

export function createMcpConnectionStore(options: McpConnectionStoreOptions): McpConnectionStore {
  const connectionsDirectory = join(options.directory, "connections");
  preparePrivateDirectory(options.directory);
  preparePrivateDirectory(connectionsDirectory);
  const records = new Map<McpConnectionId, McpConnectionEnvelope>();

  for (const fileName of readdirSync(connectionsDirectory).sort()) {
    if (!fileName.endsWith(".json")) throw new Error("MCP connection directory contains an unknown file");
    const id = parseMcpConnectionId(fileName.slice(0, -5));
    const path = join(connectionsDirectory, fileName);
    chmodSync(path, 0o600);
    const envelope = parseEnvelope(JSON.parse(readFileSync(path, "utf8")) as unknown, id);
    if (records.has(id)) throw new Error("MCP connection identifier is duplicated");
    records.set(id, envelope);
  }
  if (records.size > maximumMcpConnections) throw new Error("MCP connection registry exceeds its limit");

  const pathFor = (id: McpConnectionId) => join(connectionsDirectory, `${id}.json`);

  function publicState(): McpConnectionRegistryState {
    return parseMcpConnectionRegistryState({
      connections: [...records.values()].map(({ profile }) => profile),
      encryptionAvailable: options.cipher.isEncryptionAvailable(),
    });
  }

  function allocateId(): McpConnectionId {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = parseMcpConnectionId(options.createId ? options.createId() : randomBytes(16).toString("hex"));
      if (!records.has(id)) return id;
    }
    throw new Error("Unable to allocate an MCP connection identifier");
  }

  function decryptEnvironment(envelope: McpConnectionEnvelope): McpResolvedEnvironment {
    if (envelope.encryptedEnvironment === null) return {};
    if (!options.cipher.isEncryptionAvailable()) {
      throw new Error("Credential encryption is unavailable on this system");
    }
    const decoded = Buffer.from(envelope.encryptedEnvironment, "base64");
    const parsed = JSON.parse(options.cipher.decrypt(decoded)) as unknown;
    const environment = parseMcpResolvedEnvironment(parsed);
    if (Object.keys(environment).sort().join("\0") !== [...envelope.profile.transport.environmentKeys].sort().join("\0")) {
      throw new Error("MCP connection encrypted environment is inconsistent");
    }
    return environment;
  }

  return {
    state: publicState,
    save(value) {
      const input = parseMcpConnectionConfigurationInput(value);
      const id = input.id ?? allocateId();
      const existing = records.get(id);
      if (input.id !== undefined && !existing) throw new Error("MCP connection does not exist");
      if (!existing && records.size >= maximumMcpConnections) throw new Error("MCP connection registry is full");
      const previousEnvironment = existing ? decryptEnvironment(existing) : {};
      const environmentEntries = input.environment.map(({ name, value: nextValue }) => {
        const resolvedValue = nextValue ?? previousEnvironment[name];
        if (resolvedValue === undefined) throw new Error(`MCP environment key ${name} requires a new value`);
        return [name, resolvedValue] as const;
      });
      const environment = parseMcpResolvedEnvironment(Object.fromEntries(environmentEntries));
      if (environmentEntries.length > 0 && !options.cipher.isEncryptionAvailable()) {
        throw new Error("Credential encryption is unavailable on this system");
      }
      const profile = parseMcpConnectionProfile({
        id,
        name: input.name,
        transport: {
          kind: "stdio",
          command: input.command,
          args: input.args,
          environmentKeys: environmentEntries.map(([name]) => name),
        },
      });
      const encryptedEnvironment = environmentEntries.length === 0
        ? null
        : options.cipher.encrypt(JSON.stringify(environment)).toString("base64");
      const envelope = { version: 1 as const, profile, encryptedEnvironment };
      atomicPrivateWrite(pathFor(id), `${JSON.stringify(envelope, null, 2)}\n`);
      records.set(id, envelope);
      return publicState();
    },
    remove(value) {
      const id = parseMcpConnectionId(value);
      if (!records.delete(id)) throw new Error("MCP connection does not exist");
      rmSync(pathFor(id), { force: true });
      return publicState();
    },
    resolve(value) {
      const id = parseMcpConnectionId(value);
      const envelope = records.get(id);
      if (!envelope || !existsSync(pathFor(id))) throw new Error("MCP connection does not exist");
      return { profile: envelope.profile, environment: decryptEnvironment(envelope) };
    },
  };
}
