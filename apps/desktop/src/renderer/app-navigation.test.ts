import { describe, expect, it } from "vitest";
import { initialAppNavigation, reduceAppNavigation } from "./app-navigation.js";

describe("App navigation state", () => {
  it("moves between product areas without discarding exact selections", () => {
    const initialized = reduceAppNavigation(initialAppNavigation, { type: "initialize-catalog", datasetId: "dataset", groupId: "group" });
    const settings = reduceAppNavigation(initialized, { type: "open-settings", section: "privacy" });
    expect(settings).toEqual({ view: "settings", settingsSection: "privacy", selectedDatasetId: "dataset", selectedGroupId: "group" });
    expect(reduceAppNavigation(settings, { type: "navigate", view: "groups" })).toMatchObject({ view: "groups", selectedGroupId: "group" });
  });

  it("makes clearing a selection explicit", () => {
    const initialized = { ...initialAppNavigation, selectedGroupId: "group" };
    expect(reduceAppNavigation(initialized, { type: "select-group", id: undefined }).selectedGroupId).toBeUndefined();
  });
});
