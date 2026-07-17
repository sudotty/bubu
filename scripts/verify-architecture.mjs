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

const resultVisualization = read("apps/desktop/src/renderer/ResultVisualization.tsx");
if (!resultVisualization.includes("deriveVisualizationSpec(result, title)")) {
  failures.push("result visualization is not derived through the typed local contract");
}
if (/dangerouslySetInnerHTML|innerHTML/u.test(resultVisualization)) {
  failures.push("result visualization renders untrusted HTML");
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
if (preload.includes("appendConversation")) {
  failures.push("preload exposes privileged conversation writes");
}

const conversations = read("services/data-core/internal/data/conversation.go");
for (const invariant of [
  "maximumConversationEntries = 500",
  "maximumConversationPayload = 1024 * 1024",
  "a conversation must start with a user question",
  "INSERT INTO conversation_entries",
]) {
  if (!conversations.includes(invariant)) failures.push(`conversation invariant missing: ${invariant}`);
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
  "safeStorage.isEncryptionAvailable()",
  "safeStorage.encryptString(value)",
]) {
  if (!main.includes(invariant)) failures.push(`main-process security gate missing: ${invariant}`);
}

const desktopApi = read("apps/desktop/src/main/desktop-api.ts");
if (!desktopApi.includes("isTrustedFrameUrl(frameUrl")) {
  failures.push("desktop API is missing sender-origin validation");
}
for (const invariant of [
  "replacementSessions.issue(datasetID, sourcePath)",
  "replacementSessions.consume(input.replacementToken)",
  "randomBytes(16).toString(\"hex\")",
]) {
  if (!desktopApi.includes(invariant)) failures.push(`replacement path boundary missing: ${invariant}`);
}

const replacementMapping = read("services/data-core/internal/data/replacement_mapping.go");
for (const invariant of [
  "len(mappings) != len(currentColumns)",
  "incoming column %q is mapped more than once",
  "mappedRow := make([]string, len(orderedIndexes))",
]) {
  if (!replacementMapping.includes(invariant)) failures.push(`replacement mapping invariant missing: ${invariant}`);
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

const safeQuery = read("services/data-core/internal/data/query.go");
for (const invariant of [
  "validateQueryPlanShape(plan)",
  "currentVersionID != plan.VersionID",
  'parts := []string{"SELECT "',
  "args = append(args, plan.Limit+1)",
  'predicates = append(predicates, "instr("+column.physical+", ?) > 0")',
]) {
  if (!safeQuery.includes(invariant)) failures.push(`safe query compiler invariant missing: ${invariant}`);
}

const safeGroupQuery = read("services/data-core/internal/data/group_query.go");
for (const invariant of [
  "len(plan.Joins) != len(plan.Sources)-1",
  "join.RightSourceIndex != index+1",
  "rightColumn.profile.DistinctCount != sources[join.RightSourceIndex].rowCount",
  'keyword = "LEFT JOIN"',
  "args = append(args, plan.Limit+1)",
]) {
  if (!safeGroupQuery.includes(invariant)) failures.push(`safe group query invariant missing: ${invariant}`);
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
