import { spawnSync } from "node:child_process";
import {
  buildReleaseEnvironmentPlan,
  githubSetArguments,
  releaseChildEnvironment,
  releaseSecretNames,
  releaseVariableNames,
  repositoryFromRemoteUrl,
  validateRepositoryName,
} from "./release-environment-config.mjs";

const apply = process.argv.includes("--apply");
const enableAttestations = process.argv.includes("--enable-attestations");
const repositoryArgument = process.argv.find((value) => value.startsWith("--repository="));
const unknownArguments = process.argv.slice(2).filter((value) => (
  value !== "--apply"
  && value !== "--enable-attestations"
  && !value.startsWith("--repository=")
));
if (unknownArguments.length > 0 || !repositoryArgument) {
  console.error("Usage: configure-release-environment --repository=<owner/repository> [--apply] [--enable-attestations]");
  process.exit(1);
}

let repository;
try {
  repository = validateRepositoryName(repositoryArgument.slice("--repository=".length));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const plan = buildReleaseEnvironmentPlan(process.env);
const childEnvironment = releaseChildEnvironment(process.env);
if (plan.missingNames.length > 0 || plan.validationErrors.length > 0) {
  console.error("Release environment configuration is incomplete; no remote changes were made.");
  if (plan.missingNames.length > 0) console.error(`Missing values: ${plan.missingNames.join(", ")}`);
  for (const error of plan.validationErrors) console.error(`Invalid value: ${error}`);
  process.exit(1);
}
const origin = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", stdio: "pipe" });
if (origin.status !== 0 || repositoryFromRemoteUrl(origin.stdout) !== repository) {
  console.error(`Refusing to configure ${repository}: it does not match this worktree's GitHub origin.`);
  process.exit(1);
}
const attestationWrite = plan.writes.find(({ name }) => name === "BUBU_ENABLE_ARTIFACT_ATTESTATIONS");
if (attestationWrite?.value === "true" && !enableAttestations) {
  console.error("BUBU_ENABLE_ARTIFACT_ATTESTATIONS=true requires the explicit --enable-attestations acknowledgement; no remote changes were made.");
  process.exit(1);
}

console.log(`Validated ${releaseSecretNames.length} release secrets and ${releaseVariableNames.length} required release variables for ${repository}.`);
if (!apply) {
  console.log("Dry run complete; no remote changes were made. Re-run with --apply only from the trusted publisher workstation.");
  process.exit(0);
}

function runGh(arguments_, { input } = {}) {
  const result = spawnSync("gh", arguments_, {
    encoding: "utf8",
    env: childEnvironment,
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`gh ${arguments_.slice(0, 3).join(" ")} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

function listedNames(kind) {
  const output = runGh([kind, "list", "--env", "release", "--repo", repository, "--json", "name"]);
  const values = JSON.parse(output);
  if (!Array.isArray(values) || values.some((value) => typeof value?.name !== "string")) {
    throw new Error(`GitHub returned an invalid ${kind} inventory`);
  }
  return new Set(values.map(({ name }) => name));
}

try {
  runGh(["api", `repos/${repository}/environments/release`, "--silent"]);
  for (const write of plan.writes) {
    runGh(githubSetArguments(write.kind, write.name, repository), { input: write.value });
    console.log(`Configured release ${write.kind}: ${write.name}`);
  }
  const secretNames = listedNames("secret");
  const variableNames = listedNames("variable");
  const missingSecrets = releaseSecretNames.filter((name) => !secretNames.has(name));
  const missingVariables = releaseVariableNames.filter((name) => !variableNames.has(name));
  if (missingSecrets.length > 0 || missingVariables.length > 0) {
    throw new Error(`post-write inventory is incomplete: ${[...missingSecrets, ...missingVariables].join(", ")}`);
  }
  console.log(`GitHub release environment configured and name-verified for ${repository}; secret values were never printed or placed in process arguments.`);
} catch (error) {
  console.error(`Release environment configuration stopped: ${error.message}`);
  console.error("Some earlier values may already be updated; correct the failure and rerun the same idempotent command.");
  process.exit(1);
}
