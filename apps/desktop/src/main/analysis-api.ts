import { ipcMain } from "electron";
import {
  parseGroupQueryRequest,
  parseOperationEnvelope,
  parseQueryPlanRequest,
  parseSafeGroupQueryPlan,
  parseSafeQueryPlan,
  type ConversationThread,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import {
  buildGroupQueryPlanInvocation,
  buildQueryPlanInvocation,
  createGroupQueryPlanProposal,
  createQueryPlanProposal,
  relationshipHintsForGroup,
} from "./analysis-orchestrator.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { ProviderStore } from "./provider-store.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface AnalysisApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly providerStore: ProviderStore;
  readonly operations: OperationRegistry;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : "分析失败").slice(0, 2_000);

const containsProposedPlan = (thread: ConversationThread | null, plan: unknown) => {
  const encoded = JSON.stringify(plan);
  return thread?.entries.some((entry) =>
    entry.kind === "plan" && JSON.stringify(entry.payload.proposal.plan) === encoded,
  ) ?? false;
};

export function registerAnalysisApi({
  sidecars,
  providerStore,
  operations,
  assertTrustedSender,
}: AnalysisApiDependencies): void {
  const persistError = async (
    target: { readonly kind: "dataset" | "group"; readonly id: string },
    error: unknown,
  ) => {
    await sidecars.appendConversation({
      target,
      entry: { kind: "error", role: "system", payload: { message: errorMessage(error) } },
    }).catch(() => undefined);
  };

  ipcMain.handle(desktopChannels.proposeQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const request = parseQueryPlanRequest(envelope.value);
    const target = { kind: "dataset", id: request.datasetId } as const;
    return operations.run(envelope.operationId, async (signal) => {
      await sidecars.appendConversation({
        target,
        entry: { kind: "question", role: "user", payload: { question: request.question } },
      });
      try {
        const activeProviderId = providerStore.state().activeProviderId;
        if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
        const [context, resolved] = await Promise.all([
          sidecars.modelContext(request.datasetId, "schema-synthetic", signal),
          Promise.resolve(providerStore.resolve(activeProviderId)),
        ]);
        const completion = await sidecars.generateModel(
          buildQueryPlanInvocation(resolved, context, request.question),
          signal,
        );
        const proposal = createQueryPlanProposal(request.question, context, completion);
        await sidecars.appendConversation({
          target,
          entry: { kind: "plan", role: "assistant", payload: { proposal } },
        });
        return proposal;
      } catch (error) {
        await persistError(target, error);
        throw error;
      }
    });
  });

  ipcMain.handle(desktopChannels.executeQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const plan = parseSafeQueryPlan(envelope.value);
    const target = { kind: "dataset", id: plan.datasetId } as const;
    return operations.run(envelope.operationId, async (signal) => {
      if (!containsProposedPlan(await sidecars.getConversation(target), plan)) {
        throw new Error("只能执行已经生成并审查的查询计划");
      }
      try {
        const result = await sidecars.executeQueryPlan(plan, signal);
        await sidecars.appendConversation({
          target,
          entry: { kind: "result", role: "assistant", payload: { result } },
        });
        return result;
      } catch (error) {
        await persistError(target, error);
        throw error;
      }
    });
  });

  ipcMain.handle(desktopChannels.proposeGroupQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const request = parseGroupQueryRequest(envelope.value);
    const target = { kind: "group", id: request.groupId } as const;
    return operations.run(envelope.operationId, async (signal) => {
      await sidecars.appendConversation({
        target,
        entry: { kind: "question", role: "user", payload: { question: request.question } },
      });
      try {
        const groups = await sidecars.listGroups();
        const group = groups.find(({ id }) => id === request.groupId);
        if (!group) throw new Error("数据群组不存在");
        const activeProviderId = providerStore.state().activeProviderId;
        if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
        const [contexts, relationshipOverview] = await Promise.all([
          Promise.all(group.members.map(({ id }) =>
            sidecars.modelContext(id, "schema-synthetic", signal))),
          sidecars.getGroupRelationships(group.id),
        ]);
        const relationshipHints = relationshipHintsForGroup(
          group.members.map(({ id }) => id),
          relationshipOverview.relationships,
        );
        const completion = await sidecars.generateModel(
          buildGroupQueryPlanInvocation(
            providerStore.resolve(activeProviderId),
            group.id,
            contexts,
            relationshipHints,
            request.question,
          ),
          signal,
        );
        const proposal = createGroupQueryPlanProposal(
          request.question,
          contexts,
          relationshipHints,
          completion,
        );
        await sidecars.appendConversation({
          target,
          entry: { kind: "plan", role: "assistant", payload: { proposal } },
        });
        return proposal;
      } catch (error) {
        await persistError(target, error);
        throw error;
      }
    });
  });

  ipcMain.handle(desktopChannels.executeGroupQueryPlan, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const plan = parseSafeGroupQueryPlan(envelope.value);
    const target = { kind: "group", id: plan.groupId } as const;
    return operations.run(envelope.operationId, async (signal) => {
      if (!containsProposedPlan(await sidecars.getConversation(target), plan)) {
        throw new Error("只能执行已经生成并审查的群组计划");
      }
      try {
        const result = await sidecars.executeGroupQueryPlan(plan, signal);
        await sidecars.appendConversation({
          target,
          entry: { kind: "result", role: "assistant", payload: { result } },
        });
        return result;
      } catch (error) {
        await persistError(target, error);
        throw error;
      }
    });
  });
}
