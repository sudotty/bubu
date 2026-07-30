import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseAgentDefinition,
  parseAgentDefinitionId,
  parseAgentDefinitionRegistry,
  parseAgentDefinitionSaveInput,
  type AgentDefinition,
  type AgentDefinitionId,
  type AgentDefinitionRegistry,
} from "@bubu/contracts";
import { atomicPrivateWrite, preparePrivateDirectory } from "./secure-files.js";

export interface AgentDefinitionStore {
  state(): AgentDefinitionRegistry;
  save(value: unknown): AgentDefinition;
  remove(value: unknown): AgentDefinitionRegistry;
  replace(value: unknown): AgentDefinitionRegistry;
}

interface AgentDefinitionStoreOptions {
  readonly directory: string;
  readonly now?: () => Date;
  readonly createId?: () => string;
}

const emptyRegistry: AgentDefinitionRegistry = { schemaVersion: 1, definitions: [] };

export function createAgentDefinitionStore(options: AgentDefinitionStoreOptions): AgentDefinitionStore {
  preparePrivateDirectory(options.directory);
  const path = join(options.directory, "definitions.json");
  const now = options.now ?? (() => new Date());
  let registry = existsSync(path)
    ? parseAgentDefinitionRegistry(JSON.parse(readFileSync(path, "utf8")) as unknown)
    : emptyRegistry;

  function persist(next: AgentDefinitionRegistry): AgentDefinitionRegistry {
    const parsed = parseAgentDefinitionRegistry(next);
    atomicPrivateWrite(path, `${JSON.stringify(parsed, null, 2)}\n`);
    registry = parsed;
    return registry;
  }

  function allocateId(): AgentDefinitionId {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = parseAgentDefinitionId(options.createId ? options.createId() : randomBytes(16).toString("hex"));
      if (!registry.definitions.some((definition) => definition.id === id)) return id;
    }
    throw new Error("Unable to allocate an Agent definition identifier");
  }

  return {
    state: () => registry,
    save(value) {
      const input = parseAgentDefinitionSaveInput(value);
      const existing = input.id === undefined ? undefined : registry.definitions.find(({ id }) => id === input.id);
      if (input.id !== undefined && !existing) throw new Error("Agent definition does not exist");
      if (!existing && registry.definitions.length >= 24) throw new Error("Agent definition limit reached");
      const timestamp = now().toISOString();
      const definition = parseAgentDefinition({
        schemaVersion: 1,
        id: existing?.id ?? allocateId(),
        name: input.name,
        description: input.description,
        goal: input.goal,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      const definitions = existing
        ? registry.definitions.map((candidate) => candidate.id === definition.id ? definition : candidate)
        : [...registry.definitions, definition];
      persist({ schemaVersion: 1, definitions });
      return definition;
    },
    remove(value) {
      const id = parseAgentDefinitionId(value);
      if (!registry.definitions.some((definition) => definition.id === id)) throw new Error("Agent definition does not exist");
      return persist({ schemaVersion: 1, definitions: registry.definitions.filter((definition) => definition.id !== id) });
    },
    replace(value) {
      return persist(parseAgentDefinitionRegistry(value));
    },
  };
}
