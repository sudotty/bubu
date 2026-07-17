import { chmodSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseMcpAuditEvents,
  parseMcpAuditOutcome,
  parseMcpAuditStart,
  type McpAuditEvent,
  type McpAuditOutcome,
  type McpAuditStart,
} from "@bubu/contracts";
import { atomicPrivateCreate, preparePrivateDirectory } from "./secure-files.js";

const maximumMcpAuditStarts = 10_000;
const maximumVisibleMcpAudits = 100;

export interface McpAuditStore {
  start(value: McpAuditStart): void;
  finish(value: McpAuditOutcome): void;
  list(): readonly McpAuditEvent[];
}

interface McpAuditStoreOptions {
  readonly directory: string;
  readonly maximumStarts?: number;
}

function readRecords<T>(
  directory: string,
  parse: (value: unknown) => T,
  id: (value: T) => string,
): Map<string, T> {
  const records = new Map<string, T>();
  for (const fileName of readdirSync(directory).sort()) {
    if (!fileName.endsWith(".json")) throw new Error("MCP audit directory contains an unknown file");
    const expectedId = fileName.slice(0, -5);
    const path = join(directory, fileName);
    chmodSync(path, 0o600);
    const record = parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
    if (id(record) !== expectedId) throw new Error("MCP audit identifier does not match its file");
    if (records.has(expectedId)) throw new Error("MCP audit identifier is duplicated");
    records.set(expectedId, record);
  }
  return records;
}

export function createMcpAuditStore(options: McpAuditStoreOptions): McpAuditStore {
  const maximumStarts = options.maximumStarts ?? maximumMcpAuditStarts;
  if (!Number.isInteger(maximumStarts) || maximumStarts < 1 || maximumStarts > maximumMcpAuditStarts) {
    throw new Error("MCP audit limit is invalid");
  }
  const startsDirectory = join(options.directory, "starts");
  const outcomesDirectory = join(options.directory, "outcomes");
  preparePrivateDirectory(options.directory);
  preparePrivateDirectory(startsDirectory);
  preparePrivateDirectory(outcomesDirectory);
  const starts = readRecords(startsDirectory, parseMcpAuditStart, ({ auditId }) => auditId);
  const outcomes = readRecords(outcomesDirectory, parseMcpAuditOutcome, ({ auditId }) => auditId);
  const activeThisProcess = new Set<string>();

  if (starts.size > maximumStarts) throw new Error("MCP audit registry exceeds its limit");
  for (const [auditId, outcome] of outcomes) {
    const start = starts.get(auditId);
    if (!start) throw new Error("MCP audit outcome has no matching start");
    if (Date.parse(outcome.completedAt) < Date.parse(start.startedAt)) {
      throw new Error("MCP audit outcome predates its start");
    }
  }

  const startPath = (auditId: string) => join(startsDirectory, `${auditId}.json`);
  const outcomePath = (auditId: string) => join(outcomesDirectory, `${auditId}.json`);

  return {
    start(value) {
      const start = parseMcpAuditStart(value);
      if (starts.has(start.auditId)) throw new Error("MCP audit start already exists");
      if (starts.size >= maximumStarts) throw new Error("MCP audit registry reached its limit");
      atomicPrivateCreate(startPath(start.auditId), `${JSON.stringify(start, null, 2)}\n`);
      starts.set(start.auditId, start);
      activeThisProcess.add(start.auditId);
    },
    finish(value) {
      const outcome = parseMcpAuditOutcome(value);
      const start = starts.get(outcome.auditId);
      if (!start) throw new Error("MCP audit start does not exist");
      if (outcomes.has(outcome.auditId)) throw new Error("MCP audit outcome already exists");
      if (Date.parse(outcome.completedAt) < Date.parse(start.startedAt)) {
        throw new Error("MCP audit outcome predates its start");
      }
      atomicPrivateCreate(outcomePath(outcome.auditId), `${JSON.stringify(outcome, null, 2)}\n`);
      outcomes.set(outcome.auditId, outcome);
      activeThisProcess.delete(outcome.auditId);
    },
    list() {
      const events = [...starts.values()]
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt) || right.auditId.localeCompare(left.auditId))
        .slice(0, maximumVisibleMcpAudits)
        .map((start) => {
          const outcome = outcomes.get(start.auditId);
          if (outcome) return { ...start, ...outcome };
          return { ...start, status: activeThisProcess.has(start.auditId) ? "in-progress" as const : "interrupted" as const };
        });
      return parseMcpAuditEvents(events);
    },
  };
}
