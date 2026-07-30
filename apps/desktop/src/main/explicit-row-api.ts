import { ipcMain } from "electron";
import {
  parseExplicitRowDisclosureApproval,
  parseExplicitRowDisclosureSelection,
  parseOperationEnvelope,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import { buildExplicitRowExplanationInvocation, createExplicitRowExplanation } from "./analysis-orchestrator.js";
import type { ExplicitRowApprovalSessionStore } from "./explicit-row-approval-sessions.js";
import { generateAuditedModel } from "./model-audit.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { PrivacyPolicyStore } from "./privacy-policy-store.js";
import type { ProviderStore } from "./provider-store.js";
import type { ExplicitRowPort } from "./sidecar-ports.js";

interface Dependencies {
  readonly sidecars: ExplicitRowPort;
  readonly providerStore: ProviderStore;
  readonly operations: OperationRegistry;
  readonly approvals: ExplicitRowApprovalSessionStore;
  readonly privacyPolicy: PrivacyPolicyStore;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

function destinationFor(resolved: ReturnType<ProviderStore["resolve"]>) {
  return {
    providerId: resolved.profile.id,
    providerKind: resolved.profile.kind,
    providerName: resolved.profile.name,
    model: resolved.profile.model,
    endpointOrigin: new URL(resolved.profile.baseUrl).origin,
  };
}

function disclosedText(rows: readonly { readonly cells: readonly (string | number | boolean | null)[] }[]): string[] {
  return rows.flatMap(({ cells }) => cells.flatMap((cell) => typeof cell === "string" ? [cell] : []));
}

export function registerExplicitRowApi({ sidecars, providerStore, operations, approvals, privacyPolicy, assertTrustedSender }: Dependencies): void {
  ipcMain.handle(desktopChannels.prepareExplicitRowDisclosure, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const selection = parseExplicitRowDisclosureSelection(value);
    privacyPolicy.assertModelTextAllowed(selection.purpose);
    const preview = await sidecars.previewExplicitRowDisclosure(selection);
    privacyPolicy.assertExplicitRowsAllowed(...disclosedText(preview.rows));
    const activeProviderId = providerStore.state().activeProviderId;
    if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
    const resolved = providerStore.resolve(activeProviderId);
    return approvals.issue(preview, destinationFor(resolved));
  });

  ipcMain.handle(desktopChannels.approveExplicitRowDisclosure, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseExplicitRowDisclosureApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const approved = approvals.consume(approval.approvalToken);
      const resolved = providerStore.resolve(approved.destination.providerId);
      if (JSON.stringify(destinationFor(resolved)) !== JSON.stringify(approved.destination)) {
        throw new Error("模型目标在批准后发生变化，请重新审查原始行披露");
      }
      const current = await sidecars.previewExplicitRowDisclosure(approved.preview.selection, signal);
      if (current.payloadSha256 !== approved.preview.payloadSha256 || current.payloadBytes !== approved.preview.payloadBytes) {
        throw new Error("原始行披露内容在批准后发生变化，请重新审查");
      }
      privacyPolicy.assertExplicitRowsAllowed(...disclosedText(current.rows));
      const completion = await generateAuditedModel(
        sidecars,
        buildExplicitRowExplanationInvocation(resolved, current),
        {
          purpose: "explicit-row-explanation",
          target: { kind: "dataset", id: current.selection.datasetId },
          contexts: [],
          relationshipCount: 0,
          disclosure: "explicit-rows",
          datasetCount: 1,
          columnCount: current.selection.columns.length,
          rawRowCount: current.rows.length,
        },
        signal,
      );
      return createExplicitRowExplanation(current, completion);
    });
  });

  ipcMain.handle(desktopChannels.dismissExplicitRowDisclosure, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    approvals.revoke(parseExplicitRowDisclosureApproval(value).approvalToken);
  });
}
