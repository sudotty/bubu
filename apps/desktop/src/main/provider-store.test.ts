import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createProviderStore, type CredentialCipher } from "./provider-store.js";

const directories: string[] = [];
const firstId = "1".repeat(32);

function createDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "bubu-provider-store-"));
  directories.push(directory);
  return directory;
}

function fakeCipher(available = true): CredentialCipher {
  return {
    isEncryptionAvailable: () => available,
    encrypt: (value) => Buffer.from(`cipher:${Buffer.from(value).toString("base64")}`),
    decrypt: (value) => {
      const encoded = value.toString("utf8").replace(/^cipher:/u, "");
      return Buffer.from(encoded, "base64").toString("utf8");
    },
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("provider credential store", () => {
  it("returns only summaries while resolving encrypted credentials inside main", () => {
    const directory = createDirectory();
    const store = createProviderStore({ directory, cipher: fakeCipher(), createId: () => firstId });

    const state = store.save({
      name: "OpenAI",
      kind: "openai",
      baseUrl: "https://api.openai.com/v1/",
      model: "configured-model",
      credential: "top-secret-key",
    });

    expect(state).toEqual({
      providers: [{ profile: expect.objectContaining({ id: firstId }), hasCredential: true }],
      activeProviderId: firstId,
      encryptionAvailable: true,
    });
    expect(JSON.stringify(state)).not.toContain("top-secret-key");
    expect(readFileSync(join(directory, "providers.json"), "utf8")).not.toContain("top-secret-key");
    expect(readFileSync(join(directory, "credentials", `${firstId}.bin`), "utf8")).not.toContain(
      "top-secret-key",
    );
    expect(store.resolve(firstId)).toMatchObject({ credential: "top-secret-key" });
  });

  it("preserves an existing credential when profile metadata changes", () => {
    const store = createProviderStore({
      directory: createDirectory(),
      cipher: fakeCipher(),
      createId: () => firstId,
    });
    store.save({
      name: "OpenAI",
      kind: "openai",
      baseUrl: "https://api.openai.com/v1/",
      model: "model-a",
      credential: "secret-a",
    });

    store.save({
      id: firstId,
      name: "OpenAI production",
      kind: "openai",
      baseUrl: "https://api.openai.com/v1/",
      model: "model-b",
    });

    expect(store.resolve(firstId)).toMatchObject({
      profile: { name: "OpenAI production", model: "model-b" },
      credential: "secret-a",
    });
  });

  it("fails closed when a remote credential cannot be encrypted", () => {
    const store = createProviderStore({
      directory: createDirectory(),
      cipher: fakeCipher(false),
      createId: () => firstId,
    });

    expect(() =>
      store.save({
        name: "OpenAI",
        kind: "openai",
        baseUrl: "https://api.openai.com/v1/",
        model: "configured-model",
        credential: "plaintext-must-not-be-written",
      }),
    ).toThrow("encryption");
    expect(store.state()).toEqual({
      providers: [],
      activeProviderId: null,
      encryptionAvailable: false,
    });
  });

  it("allows credential-free local providers and repairs selection after deletion", () => {
    const store = createProviderStore({
      directory: createDirectory(),
      cipher: fakeCipher(false),
      createId: () => firstId,
    });
    store.save({
      name: "Local Ollama",
      kind: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1/",
      model: "local-model",
    });

    expect(store.resolve(firstId).credential).toBe("");
    expect(store.remove(firstId)).toMatchObject({ providers: [], activeProviderId: null });
  });
});
