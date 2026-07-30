import { ipcMain } from "electron";
import { parseDatasetId, parseWebhookDestinationInput, parseWorkflowDeliveryBindingInput } from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import type { ExternalDeliveryService } from "./external-delivery-service.js";
import type { WorkflowCatalogPort } from "./sidecar-ports.js";

export function registerExternalDeliveryApi(options: { readonly sidecars: WorkflowCatalogPort; readonly delivery: ExternalDeliveryService; readonly assertTrustedSender: (url: string) => void }): void {
  const { sidecars, delivery, assertTrustedSender } = options;
  ipcMain.handle(desktopChannels.listWebhookDestinations, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return delivery.registry(); });
  ipcMain.handle(desktopChannels.saveWebhookDestination, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return delivery.saveDestination(parseWebhookDestinationInput(value)); });
  ipcMain.handle(desktopChannels.removeWebhookDestination, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return delivery.removeDestination(parseDatasetId(value)); });
  ipcMain.handle(desktopChannels.listWorkflowDeliveryBindings, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return delivery.bindings(); });
  ipcMain.handle(desktopChannels.bindWorkflowDelivery, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? ""); const input = parseWorkflowDeliveryBindingInput(value);
    const definition = (await sidecars.listWorkflows(input.target)).find(({ id }) => id === input.workflowId);
    if (!definition || definition.version !== input.definitionVersion) throw new Error("Workflow definition changed before external delivery was enabled");
    if (definition.steps.at(-1)?.kind !== "human-approval") throw new Error("External delivery requires a final human-approval workflow node");
    return delivery.bind(input);
  });
  ipcMain.handle(desktopChannels.unbindWorkflowDelivery, (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); return delivery.unbind(parseDatasetId(value)); });
  ipcMain.handle(desktopChannels.testWebhookDestination, async (event, value: unknown) => { assertTrustedSender(event.senderFrame?.url ?? ""); const job = delivery.enqueueTest(parseDatasetId(value)); await delivery.processDue(); return delivery.jobs().find(({ id }) => id === job.id) ?? job; });
  ipcMain.handle(desktopChannels.listExternalDeliveryJobs, (event) => { assertTrustedSender(event.senderFrame?.url ?? ""); return delivery.jobs(); });
}
