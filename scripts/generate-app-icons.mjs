import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pngToIco from "png-to-ico";

const source = resolve("apps", "desktop", "resources", "icons", "bubu.png");
const outputDirectory = resolve("apps", "desktop", "resources", "icons");
mkdirSync(outputDirectory, { recursive: true });
const workspace = mkdtempSync(join(tmpdir(), "bubu-icons-"));

function resize(size, output) {
  const result = spawnSync("sips", ["--resampleHeightWidth", String(size), String(size), source, "--out", output], { stdio: "ignore" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`sips failed while generating ${output}`);
}

try {
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoInputs = icoSizes.map((size) => {
    const path = join(workspace, `bubu-${size}.png`);
    resize(size, path);
    return path;
  });
  writeFileSync(join(outputDirectory, "bubu.ico"), await pngToIco(icoInputs));

  if (process.platform === "darwin") {
    const iconset = join(workspace, "bubu.iconset");
    mkdirSync(iconset);
    for (const size of [16, 32, 128, 256, 512]) {
      resize(size, join(iconset, `icon_${size}x${size}.png`));
      resize(size * 2, join(iconset, `icon_${size}x${size}@2x.png`));
    }
    const result = spawnSync("iconutil", ["-c", "icns", iconset, "-o", join(outputDirectory, "bubu.icns")], { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("iconutil failed");
  } else if (!readFileSync(new URL("../apps/desktop/resources/icons/bubu.icns", import.meta.url)).length) {
    throw new Error("The checked-in macOS icon is missing");
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
console.log("Generated native BuBu app icons from the checked-in brand master.");
