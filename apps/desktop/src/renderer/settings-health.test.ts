import { describe, expect, it } from "vitest";
import { deriveSettingsHealth } from "./settings-health.js";

describe("deriveSettingsHealth", () => {
  it("orders blockers before required and optional setup", () => {
    expect(deriveSettingsHealth({ encryptionAvailable: false, providerCount: 0, hasActiveProvider: false, connectorCount: 0 }).map(({ id }) => id)).toEqual(["encryption", "provider", "connectors"]);
  });

  it("distinguishes a missing active model and a ready configuration", () => {
    expect(deriveSettingsHealth({ encryptionAvailable: true, providerCount: 1, hasActiveProvider: false, connectorCount: 1 })[0]?.id).toBe("active-provider");
    expect(deriveSettingsHealth({ encryptionAvailable: true, providerCount: 1, hasActiveProvider: true, connectorCount: 1 })).toMatchObject([{ id: "ready", severity: "ready" }]);
  });
});
