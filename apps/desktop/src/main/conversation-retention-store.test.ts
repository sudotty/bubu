import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createConversationRetentionStore } from "./conversation-retention-store.js";

describe("conversation retention store", () => {
  it("defaults off and persists only a bounded policy", async () => {
    const directory = await mkdtemp(join(tmpdir(), "bubu-retention-"));
    const store = createConversationRetentionStore(directory);
    expect(store.state()).toEqual({ schemaVersion: 1, enabled: false, retentionDays: 90 });
    expect(store.save({ schemaVersion: 1, enabled: true, retentionDays: 120 })).toMatchObject({ enabled: true, retentionDays: 120 });
    expect(JSON.parse(await readFile(join(directory, "policy.json"), "utf8"))).toEqual({ schemaVersion: 1, enabled: true, retentionDays: 120 });
    expect(() => store.save({ schemaVersion: 1, enabled: true, retentionDays: 7 })).toThrow();
    expect(store.state()).toMatchObject({ enabled: true, retentionDays: 120 });
  });
});
