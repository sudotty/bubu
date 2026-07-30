import type { HubPermission, HubRole } from "@bubu/contracts";
const permissions: Readonly<Record<HubRole, readonly HubPermission[]>> = {
  owner: ["tenant:manage", "member:manage", "device:manage", "sync:read", "sync:write", "audit:read"],
  editor: ["sync:read", "sync:write"],
  viewer: ["sync:read"],
  auditor: ["audit:read"],
};
export const hubPermissionsForRole = (role: HubRole): readonly HubPermission[] => permissions[role];
export function assertHubPermission(role: HubRole, permission: HubPermission): void { if (!permissions[role].includes(permission)) throw new Error(`Hub role ${role} lacks ${permission}`); }
