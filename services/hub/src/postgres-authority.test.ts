import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HubAuthority, verifyHubAuditPage } from "./authority.js";
import { PostgresHubAuthority, validatePostgresConnectionString } from "./postgres-authority.js";

const databaseUrl = process.env.BUBU_HUB_TEST_DATABASE_URL;
if (process.env.BUBU_REQUIRE_POSTGRES_TEST === "1" && !databaseUrl) throw new Error("BUBU_HUB_TEST_DATABASE_URL is required for PostgreSQL Hub evidence");
const integration = databaseUrl ? describe : describe.skip;

describe("PostgreSQL Hub configuration", () => {
  it("rejects an injectable table identifier before opening a connection", () => { expect(() => new PostgresHubAuthority({} as Pool, { tableName: "state;drop table users" })).toThrow("table name"); });
  it("requires TLS for a remote database while allowing loopback and local sockets", () => { expect(() => validatePostgresConnectionString("postgresql://db.internal/hub")).toThrow("requires TLS"); expect(validatePostgresConnectionString("postgresql://db.internal/hub?sslmode=verify-full")).toContain("verify-full"); expect(validatePostgresConnectionString("postgresql://127.0.0.1/hub")).toContain("127.0.0.1"); expect(validatePostgresConnectionString("postgresql:///hub?host=%2Fvar%2Frun%2Fpostgresql")).toContain("host="); });
});

integration("PostgreSQL Hub authority", () => {
  const tableName = `bubu_hub_test_${process.pid}_${Date.now()}`; const migratedTableName = `${tableName}_migrated`; let pool: Pool; let first: PostgresHubAuthority; let second: PostgresHubAuthority;
  beforeAll(async () => { pool = new Pool({ connectionString: databaseUrl, max: 4 }); first = new PostgresHubAuthority(pool, { tableName }); second = new PostgresHubAuthority(pool, { tableName }); expect(await first.initialize()).toBe(true); expect(await second.initialize()).toBe(false); });
  afterAll(async () => { await pool.query(`DROP TABLE IF EXISTS "${tableName}"`); await pool.query(`DROP TABLE IF EXISTS "${migratedTableName}"`); await pool.end(); });
  it("serializes writers, rolls failed changes back and never persists the device token", async () => {
    const bootstrap = await first.bootstrap({ tenantName: "Acme", ownerName: "Owner", deviceName: "Mac" }); await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 === 0 ? first : second).createMember(bootstrap.deviceToken, { displayName: `Member ${index}`, role: index % 2 === 0 ? "editor" : "viewer" }))); const beforeFailure = await first.audit(bootstrap.deviceToken); expect(beforeFailure.events).toHaveLength(9); await expect(second.createMember(bootstrap.deviceToken, { displayName: "Invalid", role: "owner" })).rejects.toThrow(); const afterFailure = await second.audit(bootstrap.deviceToken); expect(afterFailure.events).toHaveLength(beforeFailure.events.length); expect(verifyHubAuditPage(afterFailure, bootstrap.auditVerificationKey)).toBe(true); const stored = await pool.query<{ state_json: unknown }>(`SELECT state_json FROM "${tableName}" WHERE singleton = 1`); expect(JSON.stringify(stored.rows[0]?.state_json)).not.toContain(bootstrap.deviceToken);
  });
  it("imports a validated private-file snapshot only into an uninitialized PostgreSQL store", async () => { const local = new HubAuthority(); const bootstrap = local.bootstrap({ tenantName: "Migrated", ownerName: "Owner", deviceName: "Mac" }); const migrated = new PostgresHubAuthority(pool, { tableName: migratedTableName }); expect(await migrated.initialize(local.snapshot())).toBe(true); expect(await migrated.initialize(local.snapshot())).toBe(false); expect(verifyHubAuditPage(await migrated.audit(bootstrap.deviceToken), bootstrap.auditVerificationKey)).toBe(true); });
});
