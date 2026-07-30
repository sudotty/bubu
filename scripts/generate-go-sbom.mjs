import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const tool = "github.com/CycloneDX/cyclonedx-gomod@v1.10.0";
const expectedSum = "h1:9Vy3zcC+lJLgcR4xYQvwPGU6L2Rij/Ld47lyucYjVI0=";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: "pipe" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

export function assertGoToolDigest(metadata) {
  if (metadata?.Path !== "github.com/CycloneDX/cyclonedx-gomod" || metadata?.Version !== "v1.10.0" || metadata?.Sum !== expectedSum) {
    throw new Error("CycloneDX Go SBOM tool does not match the reviewed module digest");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const output = process.argv.find((value) => value.startsWith("--output="))?.slice("--output=".length);
  if (!output) throw new Error("Usage: generate-go-sbom --output=<path>");
  assertGoToolDigest(JSON.parse(run("go", ["mod", "download", "-json", tool])));
  run("go", ["run", `${tool}/cmd/cyclonedx-gomod`, "mod", "-json", "-output", output, "services/data-core"]);
  console.log(`Generated Go SBOM with reviewed ${tool} module bytes.`);
}
