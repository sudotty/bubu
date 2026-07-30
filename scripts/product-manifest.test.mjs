import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseProductManifest } from "./product-manifest.mjs";

const current = readFileSync(new URL("../PRODUCT_MANIFEST.yaml", import.meta.url), "utf8");

test("parses the current product truth as a private preview", () => {
  const manifest = parseProductManifest(current);
  assert.equal(manifest.product.releaseStage, "private-beta");
  assert.equal(manifest.release.channel, "preview");
  assert.equal(manifest.productCapabilities["local-first-data-workspace"], "available-local");
});

test("rejects duplicate YAML keys instead of accepting string-shaped truth", () => {
  assert.throws(() => parseProductManifest(current.replace("  signed-installers: planned", "  signed-installers: planned\n  signed-installers: implemented")), /unique|Map keys must be unique|invalid/iu);
});

test("rejects stable claims before general availability", () => {
  assert.throws(() => parseProductManifest(current.replace("  channel: preview", "  channel: stable")), /general availability/iu);
});

test("keeps external evidence separate from implementation", () => {
  assert.throws(() => parseProductManifest(current.replace("  signed-installers: planned", "  signed-installers: implemented")), /external evidence/iu);
});
