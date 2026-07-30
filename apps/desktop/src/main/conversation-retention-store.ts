import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseConversationRetentionPolicy, type ConversationRetentionPolicy } from "@bubu/contracts";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";

export interface ConversationRetentionStore {
  state(): ConversationRetentionPolicy;
  save(value: unknown): ConversationRetentionPolicy;
}

const defaultPolicy: ConversationRetentionPolicy = {
  schemaVersion: 1,
  enabled: false,
  retentionDays: 90,
};

export function createConversationRetentionStore(directory: string): ConversationRetentionStore {
  preparePrivateDirectory(directory);
  const path = join(directory, "policy.json");
  let policy = existsSync(path)
    ? parseConversationRetentionPolicy(JSON.parse(readFileSync(path, "utf8")) as unknown)
    : defaultPolicy;
  return {
    state: () => policy,
    save(value) {
      const next = parseConversationRetentionPolicy(value);
      atomicPrivateWrite(path, `${JSON.stringify(next, null, 2)}\n`);
      policy = next;
      return policy;
    },
  };
}
