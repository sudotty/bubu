import { randomBytes } from "node:crypto";
import {
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import {
  parseProviderConfigurationInput,
  parseProviderId,
  parseProviderRegistryState,
  providerProfileSchema,
  type ProviderConfigurationInput,
  type ProviderId,
  type ProviderKind,
  type ProviderProfile,
  type ProviderRegistryState,
} from "@bubu/contracts";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";

export interface CredentialCipher {
  isEncryptionAvailable(): boolean;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

export interface ResolvedProvider {
  readonly profile: ProviderProfile;
  readonly credential: string;
}

export interface ProviderStore {
  state(): ProviderRegistryState;
  save(value: ProviderConfigurationInput): ProviderRegistryState;
  select(value: ProviderId): ProviderRegistryState;
  remove(value: ProviderId): ProviderRegistryState;
  resolve(value: ProviderId): ResolvedProvider;
}

interface ProviderStoreOptions {
  readonly directory: string;
  readonly cipher: CredentialCipher;
  readonly createId?: () => string;
}

interface ProviderMetadata {
  readonly version: 1;
  readonly profiles: readonly ProviderProfile[];
  readonly activeProviderId: ProviderId | null;
}

function requiresCredential(kind: ProviderKind): boolean {
  return kind === "openai" || kind === "anthropic" || kind === "gemini";
}

function parseMetadata(value: unknown): ProviderMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Provider metadata is invalid");
  }
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new Error("Provider metadata version is unsupported");
  const profiles = providerProfileSchema.array().max(50).parse(record.profiles);
  const activeProviderId = record.activeProviderId === null
    ? null
    : parseProviderId(record.activeProviderId);
  if (
    activeProviderId !== null &&
    !profiles.some((profile) => profile.id === activeProviderId)
  ) {
    throw new Error("Provider metadata references a missing active provider");
  }
  return { version: 1, profiles, activeProviderId };
}

export function createProviderStore(options: ProviderStoreOptions): ProviderStore {
  const credentialsDirectory = join(options.directory, "credentials");
  const metadataPath = join(options.directory, "providers.json");
  preparePrivateDirectory(options.directory);
  preparePrivateDirectory(credentialsDirectory);

  let metadata = existsSync(metadataPath)
    ? parseMetadata(JSON.parse(readFileSync(metadataPath, "utf8")) as unknown)
    : { version: 1, profiles: [], activeProviderId: null } as const;

  const credentialPath = (providerId: ProviderId) => join(credentialsDirectory, `${providerId}.bin`);
  const hasCredential = (providerId: ProviderId) => existsSync(credentialPath(providerId));

  function registryState(): ProviderRegistryState {
    return parseProviderRegistryState({
      providers: metadata.profiles.map((profile) => ({
        profile,
        hasCredential: hasCredential(profile.id),
      })),
      activeProviderId: metadata.activeProviderId,
      encryptionAvailable: options.cipher.isEncryptionAvailable(),
    });
  }

  function persist(next: ProviderMetadata): void {
    atomicPrivateWrite(metadataPath, `${JSON.stringify(next, null, 2)}\n`);
    metadata = next;
  }

  function allocateId(): ProviderId {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = parseProviderId(
        options.createId ? options.createId() : randomBytes(16).toString("hex"),
      );
      if (!metadata.profiles.some(({ id }) => id === candidate)) return candidate;
    }
    throw new Error("Unable to allocate a provider identifier");
  }

  return {
    state: registryState,
    save(value) {
      const input = parseProviderConfigurationInput(value);
      const id = input.id ?? allocateId();
      const existingIndex = metadata.profiles.findIndex((profile) => profile.id === id);
      if (input.id !== undefined && existingIndex < 0) {
        throw new Error("Provider does not exist");
      }
      if (input.credential !== undefined && !options.cipher.isEncryptionAvailable()) {
        throw new Error("Credential encryption is unavailable on this system");
      }
      if (
        requiresCredential(input.kind) &&
        input.credential === undefined &&
        !hasCredential(id)
      ) {
        throw new Error("This provider requires an encrypted credential");
      }

      const profile = providerProfileSchema.parse({
        id,
        name: input.name,
        kind: input.kind,
        baseUrl: input.baseUrl,
        model: input.model,
      });
      if (input.credential !== undefined) {
        atomicPrivateWrite(credentialPath(id), options.cipher.encrypt(input.credential));
      }

      const profiles = [...metadata.profiles];
      if (existingIndex >= 0) profiles[existingIndex] = profile;
      else profiles.push(profile);
      persist({
        version: 1,
        profiles,
        activeProviderId: metadata.activeProviderId ?? id,
      });
      return registryState();
    },
    select(value) {
      const id = parseProviderId(value);
      if (!metadata.profiles.some((profile) => profile.id === id)) {
        throw new Error("Provider does not exist");
      }
      persist({ ...metadata, activeProviderId: id });
      return registryState();
    },
    remove(value) {
      const id = parseProviderId(value);
      const profiles = metadata.profiles.filter((profile) => profile.id !== id);
      if (profiles.length === metadata.profiles.length) throw new Error("Provider does not exist");
      const activeProviderId = metadata.activeProviderId === id ? profiles[0]?.id ?? null : metadata.activeProviderId;
      persist({ version: 1, profiles, activeProviderId });
      rmSync(credentialPath(id), { force: true });
      return registryState();
    },
    resolve(value) {
      const id = parseProviderId(value);
      const profile = metadata.profiles.find((candidate) => candidate.id === id);
      if (!profile) throw new Error("Provider does not exist");
      const path = credentialPath(id);
      if (!existsSync(path)) {
        if (requiresCredential(profile.kind)) throw new Error("Provider credential is missing");
        return { profile, credential: "" };
      }
      if (!options.cipher.isEncryptionAvailable()) {
        throw new Error("Credential encryption is unavailable on this system");
      }
      return { profile, credential: options.cipher.decrypt(readFileSync(path)) };
    },
  };
}
