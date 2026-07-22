import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirectories = new Set([".vite", "bin", "dist", "node_modules", "out"]);
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8");
function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : listFiles(path);
      return entry.isFile() ? [relative(repositoryRoot, path)] : [];
    });
}
const activeFiles = ["apps", "packages", "services"].flatMap((path) => listFiles(resolve(repositoryRoot, path)));
const failures = [];
for (const path of activeFiles) {
  const source = read(path);
  if (/github\.com\/wailsapp|wailsjs|@wailsio|runtime\.Events/u.test(source)) failures.push(`active product surface depends on Wails: ${path}`);
}
const inventory = read("docs/migration/bubu-bi-retirement-inventory.md");
for (const value of ["Go data and file services", "Model and prompt runtime", "React and Redux renderer", "Generated Wails bridge", "WAILS RETIRED", "bubu-bi-final-disposition.md"]) if (!inventory.includes(value)) failures.push(`legacy inventory missing disposition: ${value}`);
const finalDisposition = read("docs/migration/bubu-bi-final-disposition.md");
for (const value of ["Direct model-authored SQL and DDL", "Never migrate", "Wails prototype has been removed"]) {
  if (!finalDisposition.includes(value)) failures.push(`legacy final disposition missing safety rule: ${value}`);
}
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repositoryRoot, encoding: "utf8" }).split("\0").filter(Boolean);
if (tracked.some((path) => path.startsWith("bubu-bi/"))) failures.push("retired Wails files remain tracked");
if (failures.length) {
  console.error(`Legacy retirement verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Legacy retirement boundary verified: no active Wails dependency, no tracked legacy runtime, and every retired slice has an explicit disposition.");
