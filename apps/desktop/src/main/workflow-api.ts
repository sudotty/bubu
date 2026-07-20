import { ipcMain } from "electron";
import {
  parseOperationEnvelope,
  parseWorkflowDefinitionInput,
  parseWorkflowId,
  parseWorkflowTarget,
} from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";
import { containsProposedPlan } from "./conversation-plan.js";
import type { OperationRegistry } from "./operation-registry.js";
import type { SidecarSupervisor } from "./sidecars.js";

interface WorkflowApiDependencies {
  readonly sidecars: SidecarSupervisor;
  readonly operations: OperationRegistry;
  readonly assertTrustedSender: (frameUrl: string) => void;
}

export function registerWorkflowApi({
  sidecars,
  operations,
  assertTrustedSender,
}: WorkflowApiDependencies): void {
  ipcMain.handle(desktopChannels.saveWorkflow, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseWorkflowDefinitionInput(value);
    const thread = await sidecars.getConversationByID(input.threadId);
    if (!thread || thread.target.kind !== input.target.kind || thread.target.id !== input.target.id) {
      throw new Error("工作流必须绑定当前数据目标中的对话线程");
    }
    const allStepsWereProposed = input.steps.every((step) =>
      containsProposedPlan(thread, step.kind === "dataset-query" ? step.plan : step.groupPlan));
    if (!allStepsWereProposed) {
      throw new Error("只能保存已经生成并审查过的查询计划");
    }
    return sidecars.saveWorkflow(input);
  });

  ipcMain.handle(desktopChannels.listWorkflows, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listWorkflows(parseWorkflowTarget(value));
  });

  ipcMain.handle(desktopChannels.deleteWorkflow, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    await sidecars.deleteWorkflow(parseWorkflowId(value));
  });

  ipcMain.handle(desktopChannels.runWorkflow, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const envelope = parseOperationEnvelope(value);
    const workflowId = parseWorkflowId(envelope.value);
    return operations.run(envelope.operationId, (signal) =>
      sidecars.runWorkflow(workflowId, envelope.operationId, signal));
  });

  ipcMain.handle(desktopChannels.listWorkflowRuns, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    return sidecars.listWorkflowRuns(parseWorkflowId(value));
  });
}
