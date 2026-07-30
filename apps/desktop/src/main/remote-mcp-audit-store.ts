import { chmodSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseRemoteMcpAuditEvents, parseRemoteMcpAuditOutcome, parseRemoteMcpAuditStart, type RemoteMcpAuditEvent, type RemoteMcpAuditOutcome, type RemoteMcpAuditStart } from "@bubu/contracts";
import { atomicPrivateCreate, preparePrivateDirectory } from "./secure-files.js";

export interface RemoteMcpAuditStore { start(value: RemoteMcpAuditStart): void; finish(value: RemoteMcpAuditOutcome): void; list(): readonly RemoteMcpAuditEvent[] }

function readRecords<T>(directory: string, parse: (value: unknown) => T, id: (value: T) => string): Map<string, T> {
  const records = new Map<string, T>();
  for (const file of readdirSync(directory).sort()) { if (!file.endsWith(".json")) throw new Error("Remote MCP audit directory contains an unknown file"); const path = join(directory, file); chmodSync(path, 0o600); const record = parse(JSON.parse(readFileSync(path, "utf8")) as unknown); if (id(record) !== file.slice(0, -5)) throw new Error("Remote MCP audit identifier is inconsistent"); records.set(id(record), record); }
  return records;
}

export function createRemoteMcpAuditStore(directory: string): RemoteMcpAuditStore {
  const startsDirectory = join(directory, "starts"); const outcomesDirectory = join(directory, "outcomes"); preparePrivateDirectory(directory); preparePrivateDirectory(startsDirectory); preparePrivateDirectory(outcomesDirectory);
  const starts = readRecords(startsDirectory, parseRemoteMcpAuditStart, ({ auditId }) => auditId); const outcomes = readRecords(outcomesDirectory, parseRemoteMcpAuditOutcome, ({ auditId }) => auditId); const active = new Set<string>();
  if (starts.size > 10_000) throw new Error("Remote MCP audit limit exceeded");
  return {
    start(value) { const record = parseRemoteMcpAuditStart(value); if (starts.has(record.auditId) || starts.size >= 10_000) throw new Error("Remote MCP audit cannot be started"); atomicPrivateCreate(join(startsDirectory, `${record.auditId}.json`), `${JSON.stringify(record, null, 2)}\n`); starts.set(record.auditId, record); active.add(record.auditId); },
    finish(value) { const record = parseRemoteMcpAuditOutcome(value); const start = starts.get(record.auditId); if (!start || outcomes.has(record.auditId) || record.completedAt < start.startedAt) throw new Error("Remote MCP audit cannot be finished"); atomicPrivateCreate(join(outcomesDirectory, `${record.auditId}.json`), `${JSON.stringify(record, null, 2)}\n`); outcomes.set(record.auditId, record); active.delete(record.auditId); },
    list() { return parseRemoteMcpAuditEvents([...starts.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt)).slice(0, 100).map((start) => { const outcome = outcomes.get(start.auditId); return outcome ? { ...start, ...outcome } : { ...start, status: active.has(start.auditId) ? "in-progress" as const : "interrupted" as const }; })); },
  };
}
