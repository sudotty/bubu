import { describe, expect, it } from "vitest";
import { assertHubPermission, hubPermissionsForRole } from "./hub-rbac.js";
describe("Hub RBAC", () => { it("keeps four small least-privilege roles", () => { expect(() => assertHubPermission("owner", "member:manage")).not.toThrow(); expect(() => assertHubPermission("editor", "sync:write")).not.toThrow(); expect(() => assertHubPermission("viewer", "sync:write")).toThrow(); expect(hubPermissionsForRole("auditor")).toEqual(["audit:read"]); }); });
