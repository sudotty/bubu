import { describe, expect, it } from "vitest";
import { backupFileName } from "./backup-api.js";

describe("backup filename", () => {
  it("uses a portable deterministic local date segment", () => {
    expect(backupFileName(new Date("2026-07-17T05:12:00Z"))).toBe(
      "bubu-data-2026-07-17.bubu-backup",
    );
  });
});
