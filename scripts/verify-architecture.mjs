import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function sourceFiles(directory, extensions = [".ts", ".tsx"]) {
  const result = [];
  const visit = (absolutePath) => {
    for (const entry of readdirSync(absolutePath)) {
      const child = join(absolutePath, entry);
      if (statSync(child).isDirectory()) visit(child);
      else if (extensions.includes(extname(child))) result.push(child);
    }
  };
  visit(join(root, directory));
  return result;
}

const rendererFiles = sourceFiles("apps/desktop/src/renderer");
for (const path of rendererFiles) {
  const contents = readFileSync(path, "utf8");
  for (const forbidden of [/from ["']electron["']/u, /from ["']node:/u, /\bipcRenderer\b/u]) {
    if (forbidden.test(contents)) {
      failures.push(`renderer crosses desktop privilege boundary: ${path.slice(root.length + 1)}`);
    }
  }
}

const dataCoreFiles = sourceFiles("services/data-core/internal", [".go"]);
for (const path of dataCoreFiles) {
  const lineCount = readFileSync(path, "utf8").split("\n").length;
  if (lineCount > 350) {
    failures.push(`data-core source mixes too many responsibilities (${lineCount} lines): ${path.slice(root.length + 1)}`);
  }
}

const preload = read("apps/desktop/src/preload.ts");
if (!preload.includes('contextBridge.exposeInMainWorld("bubu", desktopApi)')) {
  failures.push("preload does not expose the named BuBu product API");
}
if (preload.includes("send(") || preload.includes("on(") || preload.includes("removeListener")) {
  failures.push("preload exposes event-shaped or generic IPC behavior");
}

const security = read("apps/desktop/src/main/security.ts");
for (const invariant of [
  "nodeIntegration: false",
  "nodeIntegrationInWorker: false",
  "contextIsolation: true",
  "sandbox: true",
  "webSecurity: true",
  "allowRunningInsecureContent: false",
  "webviewTag: false",
]) {
  if (!security.includes(invariant)) failures.push(`desktop security invariant missing: ${invariant}`);
}

const main = read("apps/desktop/src/main.ts");
for (const invariant of [
  "setPermissionCheckHandler(() => false)",
  'setWindowOpenHandler(() => ({ action: "deny" }))',
  'protocol.registerSchemesAsPrivileged',
  'isTrustedFrameUrl(frameUrl',
  "safeStorage.isEncryptionAvailable()",
  "safeStorage.encryptString(value)",
]) {
  if (!main.includes(invariant)) failures.push(`main-process security gate missing: ${invariant}`);
}

const providerStore = read("apps/desktop/src/main/provider-store.ts");
for (const invariant of [
  'join(options.directory, "credentials")',
  "mode: 0o700",
  "mode: 0o600",
  "renameSync(temporaryPath, path)",
  "Credential encryption is unavailable",
]) {
  if (!providerStore.includes(invariant)) failures.push(`provider credential boundary missing: ${invariant}`);
}
if (providerStore.includes("credential:" + " input.credential")) {
  failures.push("provider credential is copied into registry metadata");
}

const sidecars = read("apps/desktop/src/main/sidecars.ts");
if (!sidecars.includes("utilityProcess.fork")) failures.push("AI runtime is not an Electron utility process");
if (!sidecars.includes('BUBU_RPC_TOKEN')) failures.push("sidecars are missing per-process credentials");

const tabularSource = read("services/data-core/internal/data/source.go");
if (tabularSource.includes("os.ReadFile")) {
  failures.push("tabular import reads an entire source file before parsing");
}
if (!tabularSource.includes("io.LimitReader(file, 64*1024)")) {
  failures.push("delimiter detection is missing its bounded streaming sample");
}

for (const path of sourceFiles("apps/desktop/src")) {
  if (path.endsWith("src/main/sidecars.ts")) continue;
  const contents = readFileSync(path, "utf8");
  if (/\b(?:spawn|exec|fork)\s*\(/u.test(contents)) {
    failures.push(`subprocess creation escaped the sidecar supervisor: ${path.slice(root.length + 1)}`);
  }
}

if (failures.length > 0) {
  console.error("Architecture verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Architecture verification passed (${rendererFiles.length} renderer files checked).`);
