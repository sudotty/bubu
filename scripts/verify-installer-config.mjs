import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const forge = read("apps/desktop/forge.config.ts").toString("utf8");
const desktop = JSON.parse(read("apps/desktop/package.json").toString("utf8"));
const manifest = read("PRODUCT_MANIFEST.yaml").toString("utf8");
const failures = [];

for (const value of ["appBundleId", "appCategoryType", "win32metadata", "MakerDMG", "MakerZIP", "MakerSquirrel", "setupIcon", "noMsi: true"]) {
  if (!forge.includes(value)) failures.push(`Forge installer configuration missing ${value}`);
}
for (const dependency of ["@electron-forge/maker-dmg", "@electron-forge/maker-squirrel", "@electron-forge/maker-zip"]) {
  if (desktop.devDependencies?.[dependency] !== "7.11.2") failures.push(`desktop must pin ${dependency} to Forge 7.11.2`);
}
if (desktop.devDependencies?.["@electron/windows-sign"] !== "2.0.6") failures.push("desktop must pin @electron/windows-sign to 2.0.6");
if (!desktop.author || !desktop.description || desktop.productName !== "BuBu") failures.push("desktop release metadata is incomplete");

const png = read("apps/desktop/resources/icons/bubu.png");
const icns = read("apps/desktop/resources/icons/bubu.icns");
const ico = read("apps/desktop/resources/icons/bubu.ico");
if (!png.subarray(1, 4).equals(Buffer.from("PNG"))) failures.push("brand master is not a PNG");
if (icns.subarray(0, 4).toString("ascii") !== "icns") failures.push("macOS icon is not ICNS");
if (!ico.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) failures.push("Windows icon is not ICO");
for (const value of ["native-application-icons: implemented", "native-installer-makers: implemented"]) {
  if (!manifest.includes(value)) failures.push(`manifest missing ${value}`);
}

if (failures.length > 0) {
  console.error(`Installer configuration verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Installer configuration verified: native metadata, icons, DMG/ZIP, and Squirrel makers are complete.");
