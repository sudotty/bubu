import { describe, expect, it } from "vitest";
import { scheduleDescription, triggerFromSchedule } from "./workflow-schedule.js";

describe("workflow schedule", () => {
  it("does not describe a manual workflow as scheduled", () => {
    expect(scheduleDescription({ preset: "manual", hour: 9, minute: 0, weekday: 1, dayOfMonth: 1 }, "Asia/Shanghai")).toBe("仅在你点击运行时执行，不会自动触发。");
  });

  it("shows and persists the exact weekly calendar choice", () => {
    const schedule = { preset: "weekly", hour: 15, minute: 30, weekday: 3, dayOfMonth: 1 } as const;
    expect(scheduleDescription(schedule, "Asia/Shanghai")).toContain("每周三 15:30");
    expect(triggerFromSchedule(schedule, "Asia/Shanghai")).toEqual({ kind: "calendar", cadence: "weekly", timeZone: "Asia/Shanghai", hour: 15, minute: 30, weekday: 3 });
  });
});
