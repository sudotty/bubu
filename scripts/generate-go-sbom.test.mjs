import assert from "node:assert/strict";
import test from "node:test";
import { assertGoToolDigest } from "./generate-go-sbom.mjs";

test("pins the Go SBOM generator by module checksum", () => {
  assert.doesNotThrow(() => assertGoToolDigest({
    Path: "github.com/CycloneDX/cyclonedx-gomod",
    Version: "v1.10.0",
    Sum: "h1:9Vy3zcC+lJLgcR4xYQvwPGU6L2Rij/Ld47lyucYjVI0=",
  }));
  assert.throws(() => assertGoToolDigest({ Path: "github.com/CycloneDX/cyclonedx-gomod", Version: "v1.10.0", Sum: "changed" }), /reviewed module digest/u);
});
