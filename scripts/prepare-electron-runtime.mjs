import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { downloadArtifact } from "@electron/get";

const repositoryRoot = resolve(import.meta.dirname, "..");
const desktopPackage = JSON.parse(
  readFileSync(join(repositoryRoot, "apps", "desktop", "package.json"), "utf8"),
);
const version = desktopPackage.devDependencies?.electron;
if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/u.test(version)) {
  console.error("Desktop Electron version must be an exact semantic version");
  process.exit(1);
}

const filename = `electron-v${version}-${process.platform}-${process.arch}.zip`;
const checksums = JSON.parse(
  readFileSync(join(repositoryRoot, "node_modules", "electron", "checksums.json"), "utf8"),
);
const expectedChecksum = checksums[filename];
if (typeof expectedChecksum !== "string") {
  console.error(`Electron checksum is missing for ${filename}`);
  process.exit(1);
}

const localCache = join(repositoryRoot, ".cache", "electron");
const target = join(localCache, filename);

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isVerified(path) {
  return existsSync(path) && statSync(path).size > 10_000_000 && sha256(path) === expectedChecksum;
}

function platformCacheRoot() {
  if (process.env.ELECTRON_CACHE) return process.env.ELECTRON_CACHE;
  if (process.platform === "darwin") return join(homedir(), "Library", "Caches", "electron");
  if (process.platform === "win32") return join(process.env.LOCALAPPDATA ?? homedir(), "electron", "Cache");
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "electron");
}

function findCachedArtifact(root) {
  if (!existsSync(root)) return undefined;
  const direct = join(root, filename);
  if (isVerified(direct)) return direct;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(root, entry.name, filename);
    if (isVerified(candidate)) return candidate;
  }
  return undefined;
}

mkdirSync(localCache, { recursive: true });
if (!isVerified(target)) {
  const cached = findCachedArtifact(platformCacheRoot());
  const source =
    cached ??
    (await downloadArtifact({
      version,
      artifactName: "electron",
      platform: process.platform,
      arch: process.arch,
    }));
  if (!isVerified(source)) {
    console.error(`Electron artifact failed checksum verification: ${source}`);
    process.exit(1);
  }
  copyFileSync(source, target);
}

console.log(`Electron runtime prepared and verified: ${target}`);
