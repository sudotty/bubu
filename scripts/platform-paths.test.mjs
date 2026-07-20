import test from "node:test";
import assert from "node:assert/strict";
import { dataCoreBinaryName, goTarget } from "./platform-paths.mjs";

test("uses a PE executable name only on Windows", () => {
  assert.equal(dataCoreBinaryName("win32"), "bubu-data-core.exe");
  assert.equal(dataCoreBinaryName("darwin"), "bubu-data-core");
  assert.equal(dataCoreBinaryName("linux"), "bubu-data-core");
});

test("maps Electron platform and architecture names to Go targets", () => {
  assert.deepEqual(goTarget("darwin", "arm64"), { goos: "darwin", goarch: "arm64" });
  assert.deepEqual(goTarget("darwin", "x64"), { goos: "darwin", goarch: "amd64" });
  assert.deepEqual(goTarget("win32", "x64"), { goos: "windows", goarch: "amd64" });
  assert.deepEqual(goTarget("win32", "arm64"), { goos: "windows", goarch: "arm64" });
  assert.throws(() => goTarget("win32", "ia32"), /Unsupported native target/u);
});
