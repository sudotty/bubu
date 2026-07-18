import { describe, expect, it } from "vitest";
import { parseLaunchMode } from "./launch-mode.js";

describe("desktop launch mode", () => {
  it("ignores smoke environment variables without the explicit flag", () => {
    expect(
      parseLaunchMode(
        [],
        {
          BUBU_SMOKE_DATA_DIR: "/tmp/injected",
          BUBU_SMOKE_SOURCE: "/tmp/injected.csv",
        },
        "/Users/example/Library/Application Support/BuBu",
      ),
    ).toEqual({
      kind: "desktop",
      dataDirectory: "/Users/example/Library/Application Support/BuBu/data",
    });
  });

  it("requires isolated absolute paths in smoke mode", () => {
    expect(() => parseLaunchMode(["--bubu-smoke-test"], {}, "/unused")).toThrow(
      "requires isolated data and two source paths",
    );
    expect(() =>
      parseLaunchMode(
        ["--bubu-smoke-test"],
        {
          BUBU_SMOKE_DATA_DIR: "relative",
          BUBU_SMOKE_SOURCE: "/tmp/source.csv",
          BUBU_SMOKE_SECOND_SOURCE: "/tmp/second.csv",
        },
        "/unused",
      ),
    ).toThrow("must be absolute");
  });

  it("returns a typed smoke mode after validation", () => {
    expect(
      parseLaunchMode(
        ["--bubu-smoke-test"],
        {
          BUBU_SMOKE_DATA_DIR: "/tmp/data",
          BUBU_SMOKE_SOURCE: "/tmp/source.csv",
          BUBU_SMOKE_SECOND_SOURCE: "/tmp/second.csv",
        },
        "/unused",
      ),
    ).toEqual({
      kind: "smoke",
      dataDirectory: "/tmp/data",
      sourcePath: "/tmp/source.csv",
      secondSourcePath: "/tmp/second.csv",
    });
  });

  it("accepts only an absolute optional screenshot directory", () => {
    expect(() =>
      parseLaunchMode(
        ["--bubu-smoke-test"],
        {
          BUBU_SMOKE_DATA_DIR: "/tmp/data",
          BUBU_SMOKE_SOURCE: "/tmp/source.csv",
          BUBU_SMOKE_SECOND_SOURCE: "/tmp/second.csv",
          BUBU_SMOKE_SCREENSHOT_DIR: "relative",
        },
        "/unused",
      ),
    ).toThrow("Packaged smoke screenshot path must be absolute");

    expect(
      parseLaunchMode(
        ["--bubu-smoke-test"],
        {
          BUBU_SMOKE_DATA_DIR: "/tmp/data",
          BUBU_SMOKE_SOURCE: "/tmp/source.csv",
          BUBU_SMOKE_SECOND_SOURCE: "/tmp/second.csv",
          BUBU_SMOKE_SCREENSHOT_DIR: "/tmp/screenshots",
        },
        "/unused",
      ),
    ).toEqual({
      kind: "smoke",
      dataDirectory: "/tmp/data",
      sourcePath: "/tmp/source.csv",
      secondSourcePath: "/tmp/second.csv",
      screenshotDirectory: "/tmp/screenshots",
    });
  });
});
