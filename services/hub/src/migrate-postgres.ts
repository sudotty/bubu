import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { PostgresHubAuthority, validatePostgresConnectionString } from "./postgres-authority.js";

const databaseUrl = process.env.BUBU_HUB_DATABASE_URL; const sourcePath = process.env.BUBU_HUB_STATE_PATH;
if (!databaseUrl || !sourcePath) throw new Error("BUBU_HUB_DATABASE_URL and BUBU_HUB_STATE_PATH are required");
const state = JSON.parse(readFileSync(resolve(sourcePath), "utf8")) as unknown; const pool = new Pool({ connectionString: validatePostgresConnectionString(databaseUrl), max: 1, connectionTimeoutMillis: 10_000 });
try { const authority = new PostgresHubAuthority(pool); const inserted = await authority.initialize(state); if (!inserted) throw new Error("PostgreSQL Hub is already initialized; refusing to overwrite authority state"); console.log("BuBu Hub authority state migrated to PostgreSQL without overwriting an existing state row."); } finally { await pool.end(); }
