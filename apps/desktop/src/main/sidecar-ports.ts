import type { SidecarSupervisor } from "./sidecars.js";

/** Narrow capability ports prevent a domain adapter from silently gaining sidecar authority. */
export type DatasetLifecyclePort = Pick<SidecarSupervisor, "deleteDataset" | "exportDataset" | "listDatasets">;
export type BackupPort = Pick<SidecarSupervisor, "createBackup" | "restoreBackup">;
type AuditedModelMethods = "startModelAudit" | "finishModelAudit" | "generateModel";
export type AnalysisPort = Pick<SidecarSupervisor, "appendConversation" | "executeGroupQueryPlan" | "executeQueryPlan" | "getConversationByID" | "getGroupRelationships" | "listGroups" | "modelContext" | AuditedModelMethods>;
export type WorkflowPort = Pick<SidecarSupervisor, "decideWorkflowApproval" | "deleteWorkflow" | "getConversationByID" | "listWorkflowApprovals" | "listWorkflowRuns" | "listWorkflows" | "runWorkflow" | "saveWorkflow">;
export type ExplicitRowPort = Pick<SidecarSupervisor, "previewExplicitRowDisclosure" | AuditedModelMethods>;
export type KnowledgePort = Pick<SidecarSupervisor, "deleteKnowledgeSource" | "importKnowledgeSource" | "listKnowledgeSources" | "previewKnowledgeDisclosure" | "rebuildKnowledgeSource" | "searchKnowledge" | AuditedModelMethods>;
export type LocalMcpInspectionPort = Pick<SidecarSupervisor, "inspectMcp">;
export type LocalMcpResourcePort = Pick<SidecarSupervisor, "readMcpResource">;
export type LocalMcpPromptPort = Pick<SidecarSupervisor, "getMcpPrompt">;
export type LocalMcpToolPort = Pick<SidecarSupervisor, "callMcpTool" | AuditedModelMethods>;
export type RemoteMcpPort = Pick<SidecarSupervisor, "callRemoteMcpTool" | "inspectRemoteMcp">;
export type WorkflowCatalogPort = Pick<SidecarSupervisor, "getConversationByID" | "listWorkflows" | "saveWorkflow">;
