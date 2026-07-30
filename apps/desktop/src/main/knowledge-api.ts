import { basename, extname } from "node:path";
import { dialog, ipcMain } from "electron";
import {
  parseDatasetId,
  parseKnowledgeDisclosureApproval,
  parseKnowledgeDisclosurePreparation,
  parseKnowledgeSearchInput,
  parseOperationEnvelope,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import { generateAuditedModel } from "./model-audit.js";
import { buildKnowledgeAnswerInvocation, createKnowledgeAnswer } from "./knowledge-orchestrator.js";
import type { KnowledgeApprovalSessionStore } from "./knowledge-approval-sessions.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { PrivacyPolicyStore } from "./privacy-policy-store.js";
import type { ProviderStore } from "./provider-store.js";
import type { KnowledgePort } from "./sidecar-ports.js";

interface Dependencies {
  readonly sidecars: KnowledgePort;
  readonly providerStore: ProviderStore;
  readonly operations: OperationRegistry;
  readonly approvals: KnowledgeApprovalSessionStore;
  readonly privacyPolicy: PrivacyPolicyStore;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

function destinationFor(resolved: ReturnType<ProviderStore["resolve"]>) {
  return { providerId: resolved.profile.id, providerKind: resolved.profile.kind, providerName: resolved.profile.name, model: resolved.profile.model, endpointOrigin: new URL(resolved.profile.baseUrl).origin };
}

export function registerKnowledgeApi({ sidecars, providerStore, operations, approvals, privacyPolicy, assertTrustedSender }: Dependencies): void {
  ipcMain.handle(desktopChannels.importKnowledgeSource, async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const selected = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "本地知识", extensions: ["txt", "md", "markdown", "pdf"] }] });
    const sourcePath = selected.filePaths[0];
    if (selected.canceled || !sourcePath) return null;
    const displayName = basename(sourcePath, extname(sourcePath));
    return sidecars.importKnowledgeSource({ sourcePath, displayName });
  });
  ipcMain.handle(desktopChannels.listKnowledgeSources, (event) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listKnowledgeSources();
  });
  ipcMain.handle(desktopChannels.rebuildKnowledgeSource, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.rebuildKnowledgeSource(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.deleteKnowledgeSource, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.deleteKnowledgeSource(parseDatasetId(value));
  });
  ipcMain.handle(desktopChannels.searchKnowledge, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.searchKnowledge(parseKnowledgeSearchInput(value));
  });
  ipcMain.handle(desktopChannels.prepareKnowledgeAnswer, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const preparation = parseKnowledgeDisclosurePreparation(value);
    privacyPolicy.assertModelTextAllowed(preparation.purpose, preparation.search.query);
    const result = await sidecars.searchKnowledge(preparation.search);
    if (result.citations.length === 0) throw new Error("没有检索到可引用段落；不会向模型发送空证据请求");
    const preview = await sidecars.previewKnowledgeDisclosure(preparation.purpose, result);
    privacyPolicy.assertKnowledgeChunksAllowed(...preview.citations.map(({ text }) => text));
    const activeProviderId = providerStore.state().activeProviderId;
    if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
    const resolved = providerStore.resolve(activeProviderId);
    return approvals.issue(preparation.search, preview, destinationFor(resolved));
  });
  ipcMain.handle(desktopChannels.approveKnowledgeAnswer, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseKnowledgeDisclosureApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const approved = approvals.consume(approval.approvalToken);
      const resolved = providerStore.resolve(approved.destination.providerId);
      if (JSON.stringify(destinationFor(resolved)) !== JSON.stringify(approved.destination)) throw new Error("模型目标在批准后发生变化，请重新审查知识披露");
      const result = await sidecars.searchKnowledge(approved.search, signal);
      const current = await sidecars.previewKnowledgeDisclosure(approved.preview.purpose, result, signal);
      if (current.payloadSha256 !== approved.preview.payloadSha256 || current.payloadBytes !== approved.preview.payloadBytes) throw new Error("知识来源或检索结果在批准后发生变化，请重新审查");
      privacyPolicy.assertKnowledgeChunksAllowed(...current.citations.map(({ text }) => text));
      const completion = await generateAuditedModel(sidecars, buildKnowledgeAnswerInvocation(resolved, current), {
        purpose: "knowledge-answer", target: { kind: "knowledge-source", id: approved.search.sourceIds[0]! }, contexts: [],
        disclosure: "retrieved-chunks", datasetCount: 0, columnCount: 0, retrievedChunkCount: current.citations.length, relationshipCount: 0,
      }, signal);
      return createKnowledgeAnswer(current, completion);
    });
  });
  ipcMain.handle(desktopChannels.dismissKnowledgeAnswer, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    approvals.revoke(parseKnowledgeDisclosureApproval(value).approvalToken);
  });
}
