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
for (const value of ["Go data and file services", "Model and prompt runtime", "React and Redux renderer", "Generated Wails bridge", "RETIREMENT DECISION RECORDED", "bubu-bi-final-disposition.md"]) if (!inventory.includes(value)) failures.push(`legacy inventory missing disposition: ${value}`);
const finalDisposition = read("docs/migration/bubu-bi-final-disposition.md");
for (const value of ["Direct model-authored SQL and DDL", "Never migrate", "Delete `bubu-bi` only after"]) {
  if (!finalDisposition.includes(value)) failures.push(`legacy final disposition missing safety rule: ${value}`);
}
if (!read("bubu-bi/README.md").toLowerCase().includes("migration")) failures.push("legacy README must identify bubu-bi as migration input");
if (failures.length) {
  console.error(`Legacy retirement verification failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("Legacy retirement boundary verified: no active Wails dependency and every legacy slice has an explicit disposition.");
