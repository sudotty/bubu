import { ipcMain } from "electron";
import {
  parseAggregateExplanationApproval,
  parseAggregateExplanationPreparation,
  parseGroupQueryRequest,
  parseOperationEnvelope,
  parseQueryPlanRequest,
  parseSafeGroupQueryPlan,
  parseSafeQueryPlan,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import {
  buildAggregateExplanationInvocation,
  buildGroupQueryPlanInvocation,
  buildQueryPlanInvocation,
  createGroupQueryPlanProposal,
  createAggregateExplanation,
  createQueryPlanProposal,
  relationshipHintsForGroup,
} from "./analysis-orchestrator.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { ProviderStore } from "./provider-store.js";
import type { SidecarSupervisor } from "./sidecars.js";
import { containsProposedPlan } from "./conversation-plan.js";
import { findReviewedAggregateSource } from "./conversation-plan.js";
import { generateAuditedModel } from "./model-audit.js";
import {
  deriveAggregateDisclosure,
  deriveGroupAggregateDisclosure,
} from "./aggregate-disclosure.js";
import type { AggregateApprovalSessionStore } from "./aggregate-approval-sessions.js";

interface AnalysisApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly providerStore: ProviderStore;
  readonly operations: OperationRegistry;
  readonly aggregateApprovals: AggregateApprovalSessionStore;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : "分析失败").slice(0, 2_000);

export function registerAnalysisApi({
  sidecars,
  providerStore,
  operations,
  aggregateApprovals,
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

  ipcMain.handle(desktopChannels.prepareAggregateExplanation, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const { plan } = parseAggregateExplanationPreparation(value);
    const target = "datasetId" in plan
      ? { kind: "dataset" as const, id: plan.datasetId }
      : { kind: "group" as const, id: plan.groupId };
    const source = findReviewedAggregateSource(await sidecars.getConversation(target), plan);
    if (!source) throw new Error("只能解释已经审查、执行并保存的查询结果");
    const disclosure = "datasetId" in plan
      ? (() => {
          if (!("datasetId" in source.result)) throw new Error("查询计划与结果类型不匹配");
          return deriveAggregateDisclosure(source.question, plan, source.result);
        })()
      : (() => {
          if (!("groupId" in source.result)) throw new Error("群组计划与结果类型不匹配");
          return deriveGroupAggregateDisclosure(source.question, plan, source.result);
        })();
    const activeProviderId = providerStore.state().activeProviderId;
    if (activeProviderId === null) throw new Error("请先在模型设置中配置并选择一个模型");
    const resolved = providerStore.resolve(activeProviderId);
    return aggregateApprovals.issue(disclosure, {
      providerId: resolved.profile.id,
      providerKind: resolved.profile.kind,
      providerName: resolved.profile.name,
      model: resolved.profile.model,
      endpointOrigin: new URL(resolved.profile.baseUrl).origin,
    });
  });

  ipcMain.handle(desktopChannels.approveAggregateExplanation, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const approval = parseAggregateExplanationApproval(envelope.value);
    return operations.run(envelope.operationId, async (signal) => {
      const approved = aggregateApprovals.consume(approval.approvalToken);
      const resolved = providerStore.resolve(approved.destination.providerId);
      const currentDestination = {
        providerId: resolved.profile.id,
        providerKind: resolved.profile.kind,
        providerName: resolved.profile.name,
        model: resolved.profile.model,
        endpointOrigin: new URL(resolved.profile.baseUrl).origin,
      };
      if (JSON.stringify(currentDestination) !== JSON.stringify(approved.destination)) {
        throw new Error("模型目标在批准后发生变化，请重新审查披露内容");
      }
      try {
        const completion = await generateAuditedModel(
          sidecars,
          buildAggregateExplanationInvocation(resolved, approved.disclosure),
          {
            purpose: "aggregate-explanation",
            target: approved.disclosure.target,
            contexts: [],
            relationshipCount: 0,
            disclosure: "aggregates",
            datasetCount: approved.disclosure.sourceCount,
            columnCount: approved.disclosure.columns.length,
            aggregateRowCount: approved.disclosure.rows.length,
          },
          signal,
        );
        const explanation = createAggregateExplanation(approved.disclosure, completion);
        await sidecars.appendConversation({
          target: approved.disclosure.target,
          entry: { kind: "insight", role: "assistant", payload: { explanation } },
        });
        return explanation;
      } catch (error) {
        await persistError(approved.disclosure.target, error);
        throw error;
      }
    });
  });

  ipcMain.handle(desktopChannels.dismissAggregateExplanation, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    aggregateApprovals.revoke(parseAggregateExplanationApproval(value).approvalToken);
  });

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
        const completion = await generateAuditedModel(
          sidecars,
          buildQueryPlanInvocation(resolved, context, request.question),
          { purpose: "query-plan", target, contexts: [context], relationshipCount: 0 },
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
          entry: { kind: "result", role: "assistant", payload: { result, sourcePlan: plan } },
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
        const completion = await generateAuditedModel(
          sidecars,
          buildGroupQueryPlanInvocation(
            providerStore.resolve(activeProviderId),
            group.id,
            contexts,
            relationshipHints,
            request.question,
          ),
          {
            purpose: "group-query-plan", target, contexts,
            relationshipCount: relationshipHints.length,
          },
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
          entry: { kind: "result", role: "assistant", payload: { result, sourcePlan: plan } },
        });
        return result;
      } catch (error) {
        await persistError(target, error);
        throw error;
      }
    });
  });
}
