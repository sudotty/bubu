import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const root = readJson("package.json");
const workspaces = [
  ["apps/desktop/package.json", "@bubu/desktop"],
  ["packages/contracts/package.json", "@bubu/contracts"],
  ["services/ai-runtime/package.json", "@bubu/ai-runtime"],
];
const failures = [];
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u;

if (typeof root.version !== "string" || !semver.test(root.version)) {
  failures.push(`root version is not semantic versioning: ${String(root.version)}`);
}

for (const [path, expectedName] of workspaces) {
  const workspace = readJson(path);
  if (workspace.name !== expectedName) failures.push(`${path} has unexpected package name ${String(workspace.name)}`);
  if (workspace.version !== root.version) failures.push(`${path} version ${String(workspace.version)} differs from product ${root.version}`);
  for (const [dependency, version] of Object.entries(workspace.dependencies ?? {})) {
    if (dependency.startsWith("@bubu/") && version !== root.version) {
      failures.push(`${path} pins ${dependency} to ${String(version)} instead of ${root.version}`);
    }
  }
}

const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined;
if (tag && tag !== `v${root.version}`) failures.push(`release tag ${tag} must equal v${root.version}`);

if (failures.length > 0) {
  console.error(`Version contract failed:\n\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Version contract verified: BuBu v${root.version} is the single product version${tag ? ` and matches ${tag}` : ""}.`);
