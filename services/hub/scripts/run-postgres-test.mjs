import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hubDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vitest = resolve(hubDirectory, "../../node_modules/vitest/vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", "src/postgres-authority.test.ts"], { cwd: hubDirectory, env: { ...process.env, BUBU_REQUIRE_POSTGRES_TEST: "1" }, stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
