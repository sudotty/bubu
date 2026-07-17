import { describe, expect, it } from "vitest";
import { parseDataBackupResult, parseDataRestoreResult } from "./backup.js";

const summary = {
  fileName: "bubu-2026-07-17.bubu-backup",
  backupCreatedAt: "2026-07-17T05:00:00Z",
  databaseBytes: 4096,
  datasetCount: 2,
  groupCount: 1,
} as const;

describe("local data backup boundary", () => {
  it("returns bounded metadata without the destination path", () => {
    expect(parseDataBackupResult({ status: "created", ...summary })).toEqual({ status: "created", ...summary });
    expect(() => parseDataBackupResult({ status: "created", ...summary, fileName: "/private/backup" })).toThrow();
  });

  it("restores only a strict backup summary", () => {
    expect(parseDataRestoreResult({ status: "restored", ...summary })).toEqual({ status: "restored", ...summary });
    expect(() => parseDataRestoreResult({ status: "restored", ...summary, sourcePath: "/private/backup" })).toThrow();
  });
});
