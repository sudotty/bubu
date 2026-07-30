import { ipcMain } from "electron";
import { parseDatasetId, parseHubBootstrapRequest, parseHubConnectionInput, parseHubQueueDeleteInput, parseHubQueueWorkflowRequest, parseHubResolveConflictInput } from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { HubSyncService } from "./hub-sync-service.js";
import type { WorkflowCatalogPort } from "./sidecar-ports.js";
import { applyRemoteWorkflowObject } from "./hub-application-service.js";

export function registerHubSyncApi(options: { readonly sidecars: WorkflowCatalogPort; readonly hub: HubSyncService; readonly assertTrustedSender: (url: string) => void }): void {
  const { sidecars, hub, assertTrustedSender } = options;
  ipcMain.handle(desktopChannels.getHubProfile, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.profile(); });
  ipcMain.handle(desktopChannels.configureHub, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.configure(parseHubConnectionInput(value)); });
  ipcMain.handle(desktopChannels.bootstrapHub, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.bootstrap(parseHubBootstrapRequest(value)); });
  ipcMain.handle(desktopChannels.disconnectHub, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); hub.disconnect(); });
  ipcMain.handle(desktopChannels.queueHubWorkflow, async (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); const input = parseHubQueueWorkflowRequest(value); const workflow = (await sidecars.listWorkflows(input.target)).find(({ id }) => id === input.workflowId); if (!workflow) throw new Error("Workflow does not exist"); return hub.queueWorkflow(workflow); });
  ipcMain.handle(desktopChannels.listHubQueue, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.queue(); });
  ipcMain.handle(desktopChannels.deleteHubObject, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); const input = parseHubQueueDeleteInput(value); return hub.queueDelete(input.objectId, input.objectKind); });
  ipcMain.handle(desktopChannels.resolveHubConflict, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); const input = parseHubResolveConflictInput(value); return hub.resolveConflict(input.queueId, input.decision); });
  ipcMain.handle(desktopChannels.flushHubQueue, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.flush(); });
  ipcMain.handle(desktopChannels.pullHubObjects, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.pull(); });
  ipcMain.handle(desktopChannels.listHubObjects, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.incoming(); });
  ipcMain.handle(desktopChannels.inspectHubObject, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Synced object selection is invalid"); const record = value as Record<string, unknown>; return hub.inspectIncoming(parseDatasetId(record.objectId), typeof record.version === "number" && Number.isInteger(record.version) ? record.version : -1); });
  ipcMain.handle(desktopChannels.applyHubObject, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return applyRemoteWorkflowObject(hub, sidecars, value); });
  ipcMain.handle(desktopChannels.listHubApplications, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.applications(); });
  ipcMain.handle(desktopChannels.getHubAudit, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return hub.audit(); });
}
