import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { utilityProcess, type UtilityProcess } from "electron";
import {
  parseDatasetImportResult,
  parseDatasetSummary,
  parseDatasetVersionList,
  parseDatasetExportResult,
  parseDatasetDeletionResult,
  parseDerivedDatasetMaterializationResult,
  parseDerivedDependencyPlan,
  parseDerivedRecomputeEvent,
  parseDerivedRecomputeEvents,
  parseDataCleanReviewPreview,
  parseReconciliationPreview,
  parseReconciliationArtifact,
  parseReconciliationArtifacts,
  parseReconciliationDefinition,
  parseReconciliationReplayEvent,
  parseReconciliationReplayEvents,
  parseOptionalDerivedDatasetLineage,
  parseDataBackupResult,
  parseDataRestoreResult,
  parseColumnDistribution,
  parseDatasetGroup,
  parseDatasetGroupDeletionResult,
  parseDatasetGroupList,
  parseDatasetList,
  parseDatasetStructure,
  parseDatasetPreview,
  parseExplicitRowDisclosurePreview,
  parseKnowledgeSource,
  parseKnowledgeSources,
  parseKnowledgeSearchResult,
  parseKnowledgeDisclosurePreview,
  parseDatasetReplacementResult,
  parseSourceInspection,
  parseDatasetQualityReport,
  parseGroupRelationshipOverview,
  parseDatasetRelationship,
  parseRelationshipDeletionResult,
  parseConversationThread,
  parseConversationEntryPage,
  parseOptionalConversationThread,
  parseConversationThreadSummaryList,
  parseConversationDeletionResult,
  parseConversationRetentionResult,
  parseModelCompletion,
  parseModelContext,
  parseSafeGroupQueryResult,
  parseSafeQueryResult,
  parseServiceHealth,
  parseWorkflowDefinition,
  parseWorkflowDefinitions,
  parseWorkflowRun,
  parseWorkflowRuns,
  parseWorkflowTriggerEvent,
  parseWorkflowTriggerEvents,
  parseWorkflowApprovalRequests,
  parseModelAuditEvent,
  parseModelAuditEvents,
  parseMcpInspectionInvocation,
  parseMcpInspectionSnapshot,
  parseMcpPromptGetInvocation,
  parseMcpPromptGetResult,
  parseMcpResourceReadInvocation,
  parseMcpResourceReadResult,
  parseMcpToolCallInvocation,
  parseMcpToolCallResult,
  parseRemoteMcpInspectionInvocation,
  parseRemoteMcpToolCallInvocation,
  type DatasetImportResult,
  type DatasetRenameInput,
  type DatasetVersionSummary,
  type DatasetExportResult,
  type DatasetDeletionResult,
  type DerivedDatasetCreateInput,
  type DerivedDatasetLineage,
  type DerivedDatasetMaterializationResult,
  type DerivedDependencyPlan,
  type DerivedRecomputeEvent,
  type DataCleanPlan,
  type DataCleanQualityPolicy,
  type DataCleanReviewPreview,
  type ReconciliationPlan,
  type ReconciliationPreview,
  type ReconciliationArtifact,
  type ReconciliationDefinition,
  type ReconciliationReplayEvent,
  type DataBackupResult,
  type DataRestoreResult,
  type ColumnDistribution,
  type ColumnDistributionRequest,
  type ColumnMapping,
  type DatasetGroup,
  type DatasetGroupSaveInput,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetStructure,
  type ExplicitRowDisclosurePreview,
  type ExplicitRowDisclosureSelection,
  type KnowledgeSourceImportInput,
  type KnowledgeSource,
  type KnowledgeSearchInput,
  type KnowledgeSearchResult,
  type KnowledgeDisclosurePreview,
  type DatasetReplacementResult,
  type SourceInspection,
  type DatasetQualityReport,
  type DatasetValidationSaveInput,
  type DatasetRelationship,
  type DatasetRelationshipSaveInput,
  type DatasetSummary,
  type ConversationAppendInput,
  type ConversationTarget,
  type ConversationThread,
  type ConversationEntryPage,
  type ConversationEntryPageRequest,
  type ConversationThreadSummary,
  type ConversationCreateInput,
  type ConversationRenameInput,
  type ConversationArchiveInput,
  type ConversationDeleteInput,
  type ConversationDeletionResult,
  type ConversationRetentionResult,
  type ModelCompletion,
  type ModelContext,
  type DisclosureLevel,
  type GroupRelationshipOverview,
  type ModelInvocation,
  type SafeGroupQueryPlan,
  type SafeGroupQueryResult,
  type SafeQueryPlan,
  type SafeQueryResult,
  type WorkflowDefinition,
  type WorkflowDefinitionInput,
  type WorkflowRun,
  type WorkflowTarget,
  type WorkflowTriggerEvent,
  type WorkflowTriggerFinishInput,
  type WorkflowApprovalDecisionInput,
  type WorkflowApprovalRequest,
  type ModelAuditEvent,
  type ModelAuditFinishInput,
  type ModelAuditStartInput,
  type McpInspectionInvocation,
  type McpInspectionSnapshot,
  type McpPromptGetInvocation,
  type McpPromptGetResult,
  type McpResourceReadInvocation,
  type McpResourceReadResult,
  type McpToolCallInvocation,
  type McpToolCallResult,
  type RemoteMcpInspectionInvocation,
  type RemoteMcpToolCallInvocation,
} from "@bubu/contracts";
import { runtimePaths } from "./runtime-paths.js";
import type {
  DesktopServiceHealth,
  ProductReadiness,
} from "../shared/product-api.js";
import { RpcRequestBroker, type RpcRequestOptions } from "./rpc-broker.js";

function requestOptions(signal: AbortSignal | undefined): RpcRequestOptions {
  return signal ? { signal } : {};
}

interface RuntimeClient {
  health(): Promise<DesktopServiceHealth>;
  stop(): void;
}

class DataCoreClient implements RuntimeClient {
  readonly #process: ChildProcessWithoutNullStreams;
  readonly #broker: RpcRequestBroker;

  constructor(command: string, auth: string, dataDirectory: string) {
    this.#process = spawn(command, [], {
      env: { ...process.env, BUBU_RPC_TOKEN: auth, BUBU_DATA_DIR: dataDirectory },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#broker = new RpcRequestBroker(auth, (message) => {
      this.#process.stdin.write(`${JSON.stringify(message)}\n`);
    }, 10 * 60_000);

    const responses = createInterface({ input: this.#process.stdout, crlfDelay: Infinity });
    responses.on("line", (line) => {
      try {
        this.#broker.accept(JSON.parse(line));
      } catch {
        // Malformed sidecar output is ignored and the pending request times out.
      }
    });
    this.#process.once("exit", (code, signal) => {
      this.#broker.close(new Error(`data-core exited (code=${String(code)}, signal=${String(signal)})`));
    });
    this.#process.stderr.on("data", (chunk: Buffer) => {
      console.error(`[data-core] ${chunk.toString("utf8").trimEnd()}`);
    });
  }

  async health(): Promise<DesktopServiceHealth> {
    const health = parseServiceHealth(await this.#broker.request("system.health", {}));
    return { name: "data-core", status: health.status, capabilities: health.capabilities };
  }

  async importFiles(sourcePaths: readonly string[], signal?: AbortSignal): Promise<DatasetImportResult> {
    return parseDatasetImportResult(
      await this.#broker.request("dataset.import.batch", { sourcePaths }, requestOptions(signal)),
    );
  }

  async renameDataset(input: DatasetRenameInput): Promise<DatasetSummary> {
    return parseDatasetSummary(await this.#broker.request("dataset.rename", input));
  }

  async listDatasetVersions(datasetID: string): Promise<readonly DatasetVersionSummary[]> {
    return parseDatasetVersionList(await this.#broker.request("dataset.versions.list", { datasetId: datasetID }));
  }

  async listDatasets(): Promise<readonly DatasetSummary[]> {
    return parseDatasetList(await this.#broker.request("dataset.list", {}));
  }

  async exportDataset(datasetID: string, targetPath: string, signal?: AbortSignal): Promise<DatasetExportResult> {
    return parseDatasetExportResult(
      await this.#broker.request("dataset.export", { datasetId: datasetID, targetPath }, requestOptions(signal)),
    );
  }

  async deleteDataset(datasetID: string): Promise<DatasetDeletionResult> {
    return parseDatasetDeletionResult(
      await this.#broker.request("dataset.delete", { datasetId: datasetID }),
    );
  }

  async materializeDerivedDataset(
    input: DerivedDatasetCreateInput,
    signal?: AbortSignal,
  ): Promise<DerivedDatasetMaterializationResult> {
    return parseDerivedDatasetMaterializationResult(
      await this.#broker.request("dataset.derived.materialize", { input }, requestOptions(signal)),
    );
  }

  async previewDataCleanPlan(plan: DataCleanPlan, qualityPolicy: DataCleanQualityPolicy, signal?: AbortSignal): Promise<DataCleanReviewPreview> {
    return parseDataCleanReviewPreview(
      await this.#broker.request("dataset.clean.preview", { plan, qualityPolicy }, requestOptions(signal)),
    );
  }

  async previewReconciliation(plan: ReconciliationPlan, signal?: AbortSignal): Promise<ReconciliationPreview> {
    return parseReconciliationPreview(await this.#broker.request("reconciliation.preview", { plan }, requestOptions(signal)));
  }

  async executeReconciliation(plan: ReconciliationPlan, planFingerprint: string, reviewedAt: string, signal?: AbortSignal): Promise<ReconciliationArtifact> {
    return parseReconciliationArtifact(await this.#broker.request("reconciliation.execute", { plan, review: { kind: "one-use-approval", planFingerprint, reviewedAt } }, requestOptions(signal)));
  }

  async getReconciliationArtifact(id: string): Promise<ReconciliationArtifact> {
    return parseReconciliationArtifact(await this.#broker.request("reconciliation.artifact.get", { id }));
  }

  async saveReconciliationDefinition(artifactID: string): Promise<ReconciliationDefinition> {
    return parseReconciliationDefinition(await this.#broker.request("reconciliation.definition.save", { artifactId: artifactID }));
  }

  async listReconciliationArtifacts(datasetIDs: readonly string[]): Promise<readonly ReconciliationArtifact[]> {
    return parseReconciliationArtifacts(await this.#broker.request("reconciliation.artifacts.list", { datasetIds: datasetIDs }));
  }

  async processReconciliationReplayEvents(): Promise<readonly ReconciliationReplayEvent[]> {
    return parseReconciliationReplayEvents(await this.#broker.request("reconciliation.replay.process", {}));
  }

  async listReconciliationReplayEvents(datasetIDs: readonly string[]): Promise<readonly ReconciliationReplayEvent[]> {
    return parseReconciliationReplayEvents(await this.#broker.request("reconciliation.replay.events", { datasetIds: datasetIDs }));
  }

  async retryReconciliationReplayEvent(id: string): Promise<ReconciliationReplayEvent> {
    return parseReconciliationReplayEvent(await this.#broker.request("reconciliation.replay.retry", { id }));
  }

  async cancelReconciliationReplayEvent(id: string): Promise<ReconciliationReplayEvent> {
    return parseReconciliationReplayEvent(await this.#broker.request("reconciliation.replay.cancel", { id }));
  }

  async recomputeDerivedDataset(
    datasetID: string,
    signal?: AbortSignal,
  ): Promise<DerivedDatasetMaterializationResult> {
    return parseDerivedDatasetMaterializationResult(
      await this.#broker.request("dataset.derived.recompute", { datasetId: datasetID }, requestOptions(signal)),
    );
  }

  async getDerivedDatasetLineage(datasetID: string): Promise<DerivedDatasetLineage | null> {
    return parseOptionalDerivedDatasetLineage(
      await this.#broker.request("dataset.derived.lineage", { datasetId: datasetID }),
    );
  }

  async getDerivedDependencyPlan(datasetID: string): Promise<DerivedDependencyPlan> {
    return parseDerivedDependencyPlan(await this.#broker.request("dataset.derived.dependencies", { datasetId: datasetID }));
  }

  async processDerivedRecomputeEvents(): Promise<readonly DerivedRecomputeEvent[]> {
    return parseDerivedRecomputeEvents(await this.#broker.request("dataset.derived.recompute.process", {}));
  }

  async listDerivedRecomputeEvents(datasetID: string): Promise<readonly DerivedRecomputeEvent[]> {
    return parseDerivedRecomputeEvents(await this.#broker.request("dataset.derived.recompute.events", { datasetId: datasetID }));
  }

  async retryDerivedRecomputeEvent(id: string): Promise<DerivedRecomputeEvent> {
    return parseDerivedRecomputeEvent(await this.#broker.request("dataset.derived.recompute.retry", { id }));
  }

  async cancelDerivedRecomputeEvent(id: string): Promise<DerivedRecomputeEvent> {
    return parseDerivedRecomputeEvent(await this.#broker.request("dataset.derived.recompute.cancel", { id }));
  }

  async createBackup(targetPath: string, signal?: AbortSignal): Promise<DataBackupResult> {
    return parseDataBackupResult(
      await this.#broker.request("data.backup.create", { targetPath }, requestOptions(signal)),
    );
  }

  async restoreBackup(sourcePath: string, signal?: AbortSignal): Promise<DataRestoreResult> {
    return parseDataRestoreResult(
      await this.#broker.request("data.backup.restore", { sourcePath }, requestOptions(signal)),
    );
  }

  async preview(request: DatasetPreviewRequest): Promise<DatasetPreview> {
    return parseDatasetPreview(await this.#broker.request("dataset.preview", request));
  }

  async structure(datasetID: string): Promise<DatasetStructure> {
    return parseDatasetStructure(await this.#broker.request("dataset.structure", { datasetId: datasetID }));
  }

  async previewExplicitRowDisclosure(selection: ExplicitRowDisclosureSelection, signal?: AbortSignal): Promise<ExplicitRowDisclosurePreview> {
    return parseExplicitRowDisclosurePreview(
      await this.#broker.request("dataset.rows.disclosure.preview", selection, requestOptions(signal)),
    );
  }

  async importKnowledgeSource(input: KnowledgeSourceImportInput, signal?: AbortSignal): Promise<KnowledgeSource> {
    return parseKnowledgeSource(await this.#broker.request("knowledge.source.import", { input }, requestOptions(signal)));
  }

  async listKnowledgeSources(): Promise<readonly KnowledgeSource[]> {
    return parseKnowledgeSources(await this.#broker.request("knowledge.source.list", {}));
  }

  async rebuildKnowledgeSource(id: string): Promise<KnowledgeSource> {
    return parseKnowledgeSource(await this.#broker.request("knowledge.source.rebuild", { id }));
  }

  async deleteKnowledgeSource(id: string): Promise<void> {
    await this.#broker.request("knowledge.source.delete", { id });
  }

  async searchKnowledge(input: KnowledgeSearchInput, signal?: AbortSignal): Promise<KnowledgeSearchResult> {
    return parseKnowledgeSearchResult(await this.#broker.request("knowledge.search", { input }, requestOptions(signal)));
  }

  async previewKnowledgeDisclosure(purpose: string, result: KnowledgeSearchResult, signal?: AbortSignal): Promise<KnowledgeDisclosurePreview> {
    return parseKnowledgeDisclosurePreview(await this.#broker.request("knowledge.disclosure.preview", { purpose, result }, requestOptions(signal)));
  }

  async replaceFile(datasetID: string, sourcePath: string, signal?: AbortSignal): Promise<DatasetReplacementResult> {
    return parseDatasetReplacementResult(
      await this.#broker.request("dataset.replace", { datasetId: datasetID, sourcePath }, requestOptions(signal)),
    );
  }

  async inspectSource(sourcePath: string, signal?: AbortSignal): Promise<SourceInspection> {
    return parseSourceInspection(await this.#broker.request("dataset.source.inspect", { sourcePath }, requestOptions(signal)));
  }

  async replaceFileWithMapping(
    datasetID: string,
    sourcePath: string,
    mappings: readonly ColumnMapping[],
    signal?: AbortSignal,
  ): Promise<DatasetReplacementResult> {
    return parseDatasetReplacementResult(
      await this.#broker.request("dataset.replace.mapped", { datasetId: datasetID, sourcePath, mappings }, requestOptions(signal)),
    );
  }

  async quality(datasetID: string, signal?: AbortSignal): Promise<DatasetQualityReport> {
    return parseDatasetQualityReport(
      await this.#broker.request("dataset.quality.get", { datasetId: datasetID }, requestOptions(signal)),
    );
  }

  async distribution(request: ColumnDistributionRequest, signal?: AbortSignal): Promise<ColumnDistribution> {
    return parseColumnDistribution(
      await this.#broker.request("dataset.distribution.get", request, requestOptions(signal)),
    );
  }

  async saveValidation(input: DatasetValidationSaveInput, signal?: AbortSignal): Promise<DatasetQualityReport> {
    return parseDatasetQualityReport(
      await this.#broker.request("dataset.validation.save", { input }, requestOptions(signal)),
    );
  }

  async groupRelationships(groupID: string): Promise<GroupRelationshipOverview> {
    return parseGroupRelationshipOverview(
      await this.#broker.request("dataset.group.relationships", { groupId: groupID }),
    );
  }

  async saveRelationship(input: DatasetRelationshipSaveInput): Promise<DatasetRelationship> {
    return parseDatasetRelationship(
      await this.#broker.request("dataset.relationship.save", { input }),
    );
  }

  async deleteRelationship(relationshipID: string): Promise<void> {
    parseRelationshipDeletionResult(
      await this.#broker.request("dataset.relationship.delete", { id: relationshipID }),
    );
  }

  async listGroups(): Promise<readonly DatasetGroup[]> {
    return parseDatasetGroupList(await this.#broker.request("dataset.group.list", {}));
  }

  async saveGroup(input: DatasetGroupSaveInput): Promise<DatasetGroup> {
    return parseDatasetGroup(await this.#broker.request("dataset.group.save", input));
  }

  async deleteGroup(groupID: string): Promise<void> {
    parseDatasetGroupDeletionResult(
      await this.#broker.request("dataset.group.delete", { id: groupID }),
    );
  }

  async modelContext(datasetID: string, disclosure: DisclosureLevel, signal?: AbortSignal): Promise<ModelContext> {
    return parseModelContext(
      await this.#broker.request("dataset.context", { datasetId: datasetID, disclosure }, requestOptions(signal)),
    );
  }

  async executeQueryPlan(plan: SafeQueryPlan, signal?: AbortSignal): Promise<SafeQueryResult> {
    return parseSafeQueryResult(
      await this.#broker.request("dataset.query.execute", { plan }, requestOptions(signal)),
    );
  }

  async executeGroupQueryPlan(plan: SafeGroupQueryPlan, signal?: AbortSignal): Promise<SafeGroupQueryResult> {
    return parseSafeGroupQueryResult(
      await this.#broker.request("dataset.group.query.execute", { plan }, requestOptions(signal)),
    );
  }

  async getConversation(target: ConversationTarget): Promise<ConversationThread | null> {
    return parseOptionalConversationThread(
      await this.#broker.request("conversation.get", { target }),
    );
  }

  async getConversationByID(threadId: string): Promise<ConversationThread | null> {
    return parseOptionalConversationThread(await this.#broker.request("conversation.get.byid", { threadId }));
  }

  async pageConversationEntries(request: ConversationEntryPageRequest): Promise<ConversationEntryPage> {
    return parseConversationEntryPage(await this.#broker.request("conversation.entries.page", request));
  }

  async listConversations(target: ConversationTarget, archived = false): Promise<readonly ConversationThreadSummary[]> {
    return parseConversationThreadSummaryList(await this.#broker.request("conversation.list", { target, archived }));
  }

  async createConversation(input: ConversationCreateInput): Promise<ConversationThread> {
    return parseConversationThread(await this.#broker.request("conversation.create", { input }));
  }

  async renameConversation(input: ConversationRenameInput): Promise<ConversationThread> {
    return parseConversationThread(await this.#broker.request("conversation.rename", { input }));
  }

  async archiveConversation(input: ConversationArchiveInput): Promise<void> {
    await this.#broker.request("conversation.archive", { input });
  }

  async deleteConversation(input: ConversationDeleteInput): Promise<ConversationDeletionResult> {
    return parseConversationDeletionResult(await this.#broker.request("conversation.delete", { input }));
  }

  async applyConversationRetention(retentionDays: number): Promise<ConversationRetentionResult> {
    return parseConversationRetentionResult(await this.#broker.request("conversation.retention.apply", { retentionDays }));
  }

  async appendConversation(input: ConversationAppendInput): Promise<ConversationThread> {
    return parseConversationThread(
      await this.#broker.request("conversation.append", { input }),
    );
  }

  async saveWorkflow(input: WorkflowDefinitionInput): Promise<WorkflowDefinition> {
    return parseWorkflowDefinition(await this.#broker.request("workflow.save", { input }));
  }

  async listWorkflows(target: WorkflowTarget): Promise<readonly WorkflowDefinition[]> {
    return parseWorkflowDefinitions(await this.#broker.request("workflow.list", { target }));
  }

  async deleteWorkflow(workflowID: string): Promise<void> {
    await this.#broker.request("workflow.delete", { id: workflowID });
  }

  async runWorkflow(
    workflowID: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<WorkflowRun> {
    return parseWorkflowRun(await this.#broker.request(
      "workflow.run",
      { id: workflowID, idempotencyKey },
      requestOptions(signal),
    ));
  }

  async listWorkflowRuns(workflowID: string): Promise<readonly WorkflowRun[]> {
    return parseWorkflowRuns(await this.#broker.request("workflow.runs.list", { id: workflowID }));
  }

  async listWorkflowApprovals(): Promise<readonly WorkflowApprovalRequest[]> {
    return parseWorkflowApprovalRequests(await this.#broker.request("workflow.approvals.list", {}));
  }

  async decideWorkflowApproval(input: WorkflowApprovalDecisionInput): Promise<WorkflowRun> {
    return parseWorkflowRun(await this.#broker.request("workflow.approvals.decide", { input }));
  }

  async claimDueWorkflowTriggers(now: string): Promise<readonly WorkflowTriggerEvent[]> {
    return parseWorkflowTriggerEvents(await this.#broker.request("workflow.triggers.claim", { now }));
  }

  async finishWorkflowTrigger(input: WorkflowTriggerFinishInput): Promise<WorkflowTriggerEvent> {
    return parseWorkflowTriggerEvent(await this.#broker.request("workflow.triggers.finish", { input }));
  }

  async startModelAudit(input: ModelAuditStartInput): Promise<ModelAuditEvent> {
    return parseModelAuditEvent(await this.#broker.request("privacy.disclosure.start", { input }));
  }

  async finishModelAudit(input: ModelAuditFinishInput): Promise<ModelAuditEvent> {
    return parseModelAuditEvent(await this.#broker.request("privacy.disclosure.finish", { input }));
  }

  async listModelAudits(): Promise<readonly ModelAuditEvent[]> {
    return parseModelAuditEvents(await this.#broker.request("privacy.disclosure.list", {}));
  }

  stop(): void {
    this.#broker.close(new Error("data-core stopped by desktop"));
    this.#process.kill("SIGTERM");
  }
}

class AiRuntimeClient implements RuntimeClient {
  readonly #process: UtilityProcess;
  readonly #broker: RpcRequestBroker;

  constructor(modulePath: string, auth: string) {
    const environment: Record<string, string> = { BUBU_RPC_TOKEN: auth };
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) environment[key] = value;
    }

    this.#process = utilityProcess.fork(modulePath, [], {
      env: environment,
      serviceName: "BuBu AI Runtime",
      stdio: "pipe",
    });
    this.#broker = new RpcRequestBroker(auth, (message) => this.#process.postMessage(message), 130_000);
    this.#process.on("message", (message) => this.#broker.accept(message));
    this.#process.once("exit", (code) => {
      this.#broker.close(new Error(`ai-runtime exited (code=${code})`));
    });
    this.#process.stderr?.on("data", (chunk: Buffer) => {
      console.error(`[ai-runtime] ${chunk.toString("utf8").trimEnd()}`);
    });
  }

  async health(): Promise<DesktopServiceHealth> {
    const health = parseServiceHealth(await this.#broker.request("system.health", {}));
    return { name: "ai-runtime", status: health.status, capabilities: health.capabilities };
  }

  async generate(invocation: ModelInvocation, signal?: AbortSignal): Promise<ModelCompletion> {
    return parseModelCompletion(
      await this.#broker.request("model.generate", invocation, requestOptions(signal)),
    );
  }

  async inspectMcp(invocation: McpInspectionInvocation, signal?: AbortSignal): Promise<McpInspectionSnapshot> {
    const parsed = parseMcpInspectionInvocation(invocation);
    return parseMcpInspectionSnapshot(
      await this.#broker.request("mcp.inspect", parsed, {
        ...requestOptions(signal),
        timeoutMs: parsed.budget.maxDurationMs + 5_000,
      }),
    );
  }

  async inspectRemoteMcp(invocation: RemoteMcpInspectionInvocation, signal?: AbortSignal): Promise<McpInspectionSnapshot> {
    const parsed = parseRemoteMcpInspectionInvocation(invocation);
    return parseMcpInspectionSnapshot(await this.#broker.request("mcp.remote.inspect", parsed, { ...requestOptions(signal), timeoutMs: parsed.budget.maxDurationMs + 5_000 }));
  }

  async readMcpResource(invocation: McpResourceReadInvocation, signal?: AbortSignal): Promise<McpResourceReadResult> {
    const parsed = parseMcpResourceReadInvocation(invocation);
    return parseMcpResourceReadResult(
      await this.#broker.request("mcp.resource.read", parsed, {
        ...requestOptions(signal),
        timeoutMs: parsed.budget.maxDurationMs + 5_000,
      }),
    );
  }

  async getMcpPrompt(invocation: McpPromptGetInvocation, signal?: AbortSignal): Promise<McpPromptGetResult> {
    const parsed = parseMcpPromptGetInvocation(invocation);
    return parseMcpPromptGetResult(
      await this.#broker.request("mcp.prompt.get", parsed, {
        ...requestOptions(signal),
        timeoutMs: parsed.budget.maxDurationMs + 5_000,
      }),
    );
  }

  async callMcpTool(invocation: McpToolCallInvocation, signal?: AbortSignal): Promise<McpToolCallResult> {
    const parsed = parseMcpToolCallInvocation(invocation);
    return parseMcpToolCallResult(
      await this.#broker.request("mcp.tool.call", parsed, {
        ...requestOptions(signal),
        timeoutMs: parsed.budget.maxDurationMs + 5_000,
      }),
    );
  }

  async callRemoteMcpTool(invocation: RemoteMcpToolCallInvocation, signal?: AbortSignal): Promise<McpToolCallResult> {
    const parsed = parseRemoteMcpToolCallInvocation(invocation);
    return parseMcpToolCallResult(await this.#broker.request("mcp.remote.tool.call", parsed, { ...requestOptions(signal), timeoutMs: parsed.budget.maxDurationMs + 5_000 }));
  }

  stop(): void {
    this.#broker.close(new Error("ai-runtime stopped by desktop"));
    this.#process.kill();
  }
}

function unavailable(name: DesktopServiceHealth["name"], error: unknown): DesktopServiceHealth {
  return {
    name,
    status: "unavailable",
    capabilities: [],
    message: error instanceof Error ? error.message : "Service is unavailable",
  };
}

export interface SidecarSupervisor {
  readiness(): Promise<ProductReadiness>;
  importFiles(sourcePaths: readonly string[], signal?: AbortSignal): Promise<DatasetImportResult>;
  renameDataset(input: DatasetRenameInput): Promise<DatasetSummary>;
  listDatasetVersions(datasetID: string): Promise<readonly DatasetVersionSummary[]>;
  exportDataset(datasetID: string, targetPath: string, signal?: AbortSignal): Promise<DatasetExportResult>;
  deleteDataset(datasetID: string): Promise<DatasetDeletionResult>;
  materializeDerivedDataset(input: DerivedDatasetCreateInput, signal?: AbortSignal): Promise<DerivedDatasetMaterializationResult>;
  previewDataCleanPlan(plan: DataCleanPlan, qualityPolicy: DataCleanQualityPolicy, signal?: AbortSignal): Promise<DataCleanReviewPreview>;
  previewReconciliation(plan: ReconciliationPlan, signal?: AbortSignal): Promise<ReconciliationPreview>;
  executeReconciliation(plan: ReconciliationPlan, planFingerprint: string, reviewedAt: string, signal?: AbortSignal): Promise<ReconciliationArtifact>;
  getReconciliationArtifact(id: string): Promise<ReconciliationArtifact>;
  saveReconciliationDefinition(artifactID: string): Promise<ReconciliationDefinition>;
  listReconciliationArtifacts(datasetIDs: readonly string[]): Promise<readonly ReconciliationArtifact[]>;
  processReconciliationReplayEvents(): Promise<readonly ReconciliationReplayEvent[]>;
  listReconciliationReplayEvents(datasetIDs: readonly string[]): Promise<readonly ReconciliationReplayEvent[]>;
  retryReconciliationReplayEvent(id: string): Promise<ReconciliationReplayEvent>;
  cancelReconciliationReplayEvent(id: string): Promise<ReconciliationReplayEvent>;
  recomputeDerivedDataset(datasetID: string, signal?: AbortSignal): Promise<DerivedDatasetMaterializationResult>;
  getDerivedDatasetLineage(datasetID: string): Promise<DerivedDatasetLineage | null>;
  getDerivedDependencyPlan(datasetID: string): Promise<DerivedDependencyPlan>;
  processDerivedRecomputeEvents(): Promise<readonly DerivedRecomputeEvent[]>;
  listDerivedRecomputeEvents(datasetID: string): Promise<readonly DerivedRecomputeEvent[]>;
  retryDerivedRecomputeEvent(id: string): Promise<DerivedRecomputeEvent>;
  cancelDerivedRecomputeEvent(id: string): Promise<DerivedRecomputeEvent>;
  createBackup(targetPath: string, signal?: AbortSignal): Promise<DataBackupResult>;
  restoreBackup(sourcePath: string, signal?: AbortSignal): Promise<DataRestoreResult>;
  listDatasets(): Promise<readonly DatasetSummary[]>;
  datasetStructure(datasetID: string): Promise<DatasetStructure>;
  previewDataset(request: DatasetPreviewRequest): Promise<DatasetPreview>;
  previewExplicitRowDisclosure(selection: ExplicitRowDisclosureSelection, signal?: AbortSignal): Promise<ExplicitRowDisclosurePreview>;
  importKnowledgeSource(input: KnowledgeSourceImportInput, signal?: AbortSignal): Promise<KnowledgeSource>;
  listKnowledgeSources(): Promise<readonly KnowledgeSource[]>;
  rebuildKnowledgeSource(id: string): Promise<KnowledgeSource>;
  deleteKnowledgeSource(id: string): Promise<void>;
  searchKnowledge(input: KnowledgeSearchInput, signal?: AbortSignal): Promise<KnowledgeSearchResult>;
  previewKnowledgeDisclosure(purpose: string, result: KnowledgeSearchResult, signal?: AbortSignal): Promise<KnowledgeDisclosurePreview>;
  inspectSource(sourcePath: string, signal?: AbortSignal): Promise<SourceInspection>;
  replaceDataset(datasetID: string, sourcePath: string, signal?: AbortSignal): Promise<DatasetReplacementResult>;
  replaceDatasetWithMapping(
    datasetID: string,
    sourcePath: string,
    mappings: readonly ColumnMapping[],
    signal?: AbortSignal,
  ): Promise<DatasetReplacementResult>;
  getDatasetQuality(datasetID: string, signal?: AbortSignal): Promise<DatasetQualityReport>;
  getColumnDistribution(request: ColumnDistributionRequest, signal?: AbortSignal): Promise<ColumnDistribution>;
  saveDatasetValidation(input: DatasetValidationSaveInput, signal?: AbortSignal): Promise<DatasetQualityReport>;
  getGroupRelationships(groupID: string): Promise<GroupRelationshipOverview>;
  saveDatasetRelationship(input: DatasetRelationshipSaveInput): Promise<DatasetRelationship>;
  deleteDatasetRelationship(relationshipID: string): Promise<void>;
  modelContext(datasetID: string, disclosure: DisclosureLevel, signal?: AbortSignal): Promise<ModelContext>;
  generateModel(invocation: ModelInvocation, signal?: AbortSignal): Promise<ModelCompletion>;
  inspectMcp(invocation: McpInspectionInvocation, signal?: AbortSignal): Promise<McpInspectionSnapshot>;
  inspectRemoteMcp(invocation: RemoteMcpInspectionInvocation, signal?: AbortSignal): Promise<McpInspectionSnapshot>;
  readMcpResource(invocation: McpResourceReadInvocation, signal?: AbortSignal): Promise<McpResourceReadResult>;
  getMcpPrompt(invocation: McpPromptGetInvocation, signal?: AbortSignal): Promise<McpPromptGetResult>;
  callMcpTool(invocation: McpToolCallInvocation, signal?: AbortSignal): Promise<McpToolCallResult>;
  callRemoteMcpTool(invocation: RemoteMcpToolCallInvocation, signal?: AbortSignal): Promise<McpToolCallResult>;
  executeQueryPlan(plan: SafeQueryPlan, signal?: AbortSignal): Promise<SafeQueryResult>;
  executeGroupQueryPlan(plan: SafeGroupQueryPlan, signal?: AbortSignal): Promise<SafeGroupQueryResult>;
  getConversation(target: ConversationTarget): Promise<ConversationThread | null>;
  getConversationByID(threadId: string): Promise<ConversationThread | null>;
  pageConversationEntries(request: ConversationEntryPageRequest): Promise<ConversationEntryPage>;
  listConversations(target: ConversationTarget, archived?: boolean): Promise<readonly ConversationThreadSummary[]>;
  createConversation(input: ConversationCreateInput): Promise<ConversationThread>;
  renameConversation(input: ConversationRenameInput): Promise<ConversationThread>;
  archiveConversation(input: ConversationArchiveInput): Promise<void>;
  deleteConversation(input: ConversationDeleteInput): Promise<ConversationDeletionResult>;
  applyConversationRetention(retentionDays: number): Promise<ConversationRetentionResult>;
  appendConversation(input: ConversationAppendInput): Promise<ConversationThread>;
  saveWorkflow(input: WorkflowDefinitionInput): Promise<WorkflowDefinition>;
  listWorkflows(target: WorkflowTarget): Promise<readonly WorkflowDefinition[]>;
  deleteWorkflow(workflowID: string): Promise<void>;
  runWorkflow(workflowID: string, idempotencyKey: string, signal?: AbortSignal): Promise<WorkflowRun>;
  listWorkflowRuns(workflowID: string): Promise<readonly WorkflowRun[]>;
  listWorkflowApprovals(): Promise<readonly WorkflowApprovalRequest[]>;
  decideWorkflowApproval(input: WorkflowApprovalDecisionInput): Promise<WorkflowRun>;
  claimDueWorkflowTriggers(now: string): Promise<readonly WorkflowTriggerEvent[]>;
  finishWorkflowTrigger(input: WorkflowTriggerFinishInput): Promise<WorkflowTriggerEvent>;
  startModelAudit(input: ModelAuditStartInput): Promise<ModelAuditEvent>;
  finishModelAudit(input: ModelAuditFinishInput): Promise<ModelAuditEvent>;
  listModelAudits(): Promise<readonly ModelAuditEvent[]>;
  listGroups(): Promise<readonly DatasetGroup[]>;
  saveGroup(input: DatasetGroupSaveInput): Promise<DatasetGroup>;
  deleteGroup(groupID: string): Promise<void>;
  stop(): void;
}

export function startSidecars(dataDirectory: string): SidecarSupervisor {
  const paths = runtimePaths();
  const dataCore = new DataCoreClient(
    paths.dataCore,
    randomBytes(32).toString("hex"),
    dataDirectory,
  );
  const aiRuntime = new AiRuntimeClient(paths.aiRuntime, randomBytes(32).toString("hex"));

  return {
    async readiness() {
      const [dataCoreHealth, aiRuntimeHealth] = await Promise.all([
        dataCore.health().catch((error: unknown) => unavailable("data-core", error)),
        aiRuntime.health().catch((error: unknown) => unavailable("ai-runtime", error)),
      ]);
      const services = [dataCoreHealth, aiRuntimeHealth];
      return {
        status: services.every((service) => service.status === "ready") ? "ready" : "degraded",
        protocolVersion: 1,
        services,
      };
    },
    async importFiles(sourcePaths, signal) {
      return dataCore.importFiles(sourcePaths, signal);
    },
    renameDataset: (input) => dataCore.renameDataset(input),
    listDatasetVersions: (datasetID) => dataCore.listDatasetVersions(datasetID),
    exportDataset: (datasetID, targetPath, signal) => dataCore.exportDataset(datasetID, targetPath, signal),
    deleteDataset: (datasetID) => dataCore.deleteDataset(datasetID),
    materializeDerivedDataset: (input, signal) => dataCore.materializeDerivedDataset(input, signal),
    previewDataCleanPlan: (plan, qualityPolicy, signal) => dataCore.previewDataCleanPlan(plan, qualityPolicy, signal),
    previewReconciliation: (plan, signal) => dataCore.previewReconciliation(plan, signal),
    executeReconciliation: (plan, planFingerprint, reviewedAt, signal) => dataCore.executeReconciliation(plan, planFingerprint, reviewedAt, signal),
    getReconciliationArtifact: (id) => dataCore.getReconciliationArtifact(id),
    saveReconciliationDefinition: (artifactID) => dataCore.saveReconciliationDefinition(artifactID),
    listReconciliationArtifacts: (datasetIDs) => dataCore.listReconciliationArtifacts(datasetIDs),
    processReconciliationReplayEvents: () => dataCore.processReconciliationReplayEvents(),
    listReconciliationReplayEvents: (datasetIDs) => dataCore.listReconciliationReplayEvents(datasetIDs),
    retryReconciliationReplayEvent: (id) => dataCore.retryReconciliationReplayEvent(id),
    cancelReconciliationReplayEvent: (id) => dataCore.cancelReconciliationReplayEvent(id),
    recomputeDerivedDataset: (datasetID, signal) => dataCore.recomputeDerivedDataset(datasetID, signal),
    getDerivedDatasetLineage: (datasetID) => dataCore.getDerivedDatasetLineage(datasetID),
    getDerivedDependencyPlan: (datasetID) => dataCore.getDerivedDependencyPlan(datasetID),
    processDerivedRecomputeEvents: () => dataCore.processDerivedRecomputeEvents(),
    listDerivedRecomputeEvents: (datasetID) => dataCore.listDerivedRecomputeEvents(datasetID),
    retryDerivedRecomputeEvent: (id) => dataCore.retryDerivedRecomputeEvent(id),
    cancelDerivedRecomputeEvent: (id) => dataCore.cancelDerivedRecomputeEvent(id),
    createBackup: (targetPath, signal) => dataCore.createBackup(targetPath, signal),
    restoreBackup: (sourcePath, signal) => dataCore.restoreBackup(sourcePath, signal),
    listDatasets: () => dataCore.listDatasets(),
    datasetStructure: (datasetID) => dataCore.structure(datasetID),
    previewDataset: (request) => dataCore.preview(request),
    previewExplicitRowDisclosure: (selection, signal) => dataCore.previewExplicitRowDisclosure(selection, signal),
    importKnowledgeSource: (input, signal) => dataCore.importKnowledgeSource(input, signal),
    listKnowledgeSources: () => dataCore.listKnowledgeSources(),
    rebuildKnowledgeSource: (id) => dataCore.rebuildKnowledgeSource(id),
    deleteKnowledgeSource: (id) => dataCore.deleteKnowledgeSource(id),
    searchKnowledge: (input, signal) => dataCore.searchKnowledge(input, signal),
    previewKnowledgeDisclosure: (purpose, result, signal) => dataCore.previewKnowledgeDisclosure(purpose, result, signal),
    inspectSource: (sourcePath, signal) => dataCore.inspectSource(sourcePath, signal),
    replaceDataset: (datasetID, sourcePath, signal) => dataCore.replaceFile(datasetID, sourcePath, signal),
    replaceDatasetWithMapping: (datasetID, sourcePath, mappings, signal) =>
      dataCore.replaceFileWithMapping(datasetID, sourcePath, mappings, signal),
    getDatasetQuality: (datasetID, signal) => dataCore.quality(datasetID, signal),
    getColumnDistribution: (request, signal) => dataCore.distribution(request, signal),
    saveDatasetValidation: (input, signal) => dataCore.saveValidation(input, signal),
    getGroupRelationships: (groupID) => dataCore.groupRelationships(groupID),
    saveDatasetRelationship: (input) => dataCore.saveRelationship(input),
    deleteDatasetRelationship: (relationshipID) => dataCore.deleteRelationship(relationshipID),
    modelContext: (datasetID, disclosure, signal) => dataCore.modelContext(datasetID, disclosure, signal),
    generateModel: (invocation, signal) => aiRuntime.generate(invocation, signal),
    inspectMcp: (invocation, signal) => aiRuntime.inspectMcp(invocation, signal),
    inspectRemoteMcp: (invocation, signal) => aiRuntime.inspectRemoteMcp(invocation, signal),
    readMcpResource: (invocation, signal) => aiRuntime.readMcpResource(invocation, signal),
    getMcpPrompt: (invocation, signal) => aiRuntime.getMcpPrompt(invocation, signal),
    callMcpTool: (invocation, signal) => aiRuntime.callMcpTool(invocation, signal),
    callRemoteMcpTool: (invocation, signal) => aiRuntime.callRemoteMcpTool(invocation, signal),
    executeQueryPlan: (plan, signal) => dataCore.executeQueryPlan(plan, signal),
    executeGroupQueryPlan: (plan, signal) => dataCore.executeGroupQueryPlan(plan, signal),
    getConversation: (target) => dataCore.getConversation(target),
    getConversationByID: (threadId) => dataCore.getConversationByID(threadId),
    pageConversationEntries: (request) => dataCore.pageConversationEntries(request),
    listConversations: (target, archived) => dataCore.listConversations(target, archived),
    createConversation: (input) => dataCore.createConversation(input),
    renameConversation: (input) => dataCore.renameConversation(input),
    archiveConversation: (input) => dataCore.archiveConversation(input),
    deleteConversation: (input) => dataCore.deleteConversation(input),
    applyConversationRetention: (retentionDays) => dataCore.applyConversationRetention(retentionDays),
    appendConversation: (input) => dataCore.appendConversation(input),
    saveWorkflow: (input) => dataCore.saveWorkflow(input),
    listWorkflows: (target) => dataCore.listWorkflows(target),
    deleteWorkflow: (workflowID) => dataCore.deleteWorkflow(workflowID),
    runWorkflow: (workflowID, idempotencyKey, signal) =>
      dataCore.runWorkflow(workflowID, idempotencyKey, signal),
    listWorkflowRuns: (workflowID) => dataCore.listWorkflowRuns(workflowID),
    listWorkflowApprovals: () => dataCore.listWorkflowApprovals(),
    decideWorkflowApproval: (input) => dataCore.decideWorkflowApproval(input),
    claimDueWorkflowTriggers: (now) => dataCore.claimDueWorkflowTriggers(now),
    finishWorkflowTrigger: (input) => dataCore.finishWorkflowTrigger(input),
    startModelAudit: (input) => dataCore.startModelAudit(input),
    finishModelAudit: (input) => dataCore.finishModelAudit(input),
    listModelAudits: () => dataCore.listModelAudits(),
    listGroups: () => dataCore.listGroups(),
    saveGroup: (input) => dataCore.saveGroup(input),
    deleteGroup: (groupID) => dataCore.deleteGroup(groupID),
    stop() {
      aiRuntime.stop();
      dataCore.stop();
    },
  };
}
