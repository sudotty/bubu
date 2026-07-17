import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { app, utilityProcess, type UtilityProcess } from "electron";
import {
  parseDatasetImportResult,
  parseDatasetGroup,
  parseDatasetGroupDeletionResult,
  parseDatasetGroupList,
  parseDatasetList,
  parseDatasetPreview,
  parseDatasetReplacementResult,
  parseModelCompletion,
  parseModelContext,
  parseSafeQueryResult,
  parseServiceHealth,
  type DatasetImportResult,
  type DatasetGroup,
  type DatasetGroupSaveInput,
  type DatasetPreview,
  type DatasetPreviewRequest,
  type DatasetReplacementResult,
  type DatasetSummary,
  type ModelCompletion,
  type ModelContext,
  type DisclosureLevel,
  type ModelInvocation,
  type SafeQueryPlan,
  type SafeQueryResult,
} from "@bubu/contracts";
import type {
  DesktopServiceHealth,
  ProductReadiness,
} from "../shared/product-api.js";
import { RpcRequestBroker } from "./rpc-broker.js";

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
    });

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

  async importFiles(sourcePaths: readonly string[]): Promise<DatasetImportResult> {
    return parseDatasetImportResult(
      await this.#broker.request("dataset.import.batch", { sourcePaths }),
    );
  }

  async listDatasets(): Promise<readonly DatasetSummary[]> {
    return parseDatasetList(await this.#broker.request("dataset.list", {}));
  }

  async preview(request: DatasetPreviewRequest): Promise<DatasetPreview> {
    return parseDatasetPreview(await this.#broker.request("dataset.preview", request));
  }

  async replaceFile(datasetID: string, sourcePath: string): Promise<DatasetReplacementResult> {
    return parseDatasetReplacementResult(
      await this.#broker.request("dataset.replace", { datasetId: datasetID, sourcePath }),
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

  async modelContext(datasetID: string, disclosure: DisclosureLevel): Promise<ModelContext> {
    return parseModelContext(
      await this.#broker.request("dataset.context", { datasetId: datasetID, disclosure }),
    );
  }

  async executeQueryPlan(plan: SafeQueryPlan): Promise<SafeQueryResult> {
    return parseSafeQueryResult(
      await this.#broker.request("dataset.query.execute", { plan }),
    );
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
    this.#broker = new RpcRequestBroker(auth, (message) => this.#process.postMessage(message));
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

  async generate(invocation: ModelInvocation): Promise<ModelCompletion> {
    return parseModelCompletion(await this.#broker.request("model.generate", invocation));
  }

  stop(): void {
    this.#broker.close(new Error("ai-runtime stopped by desktop"));
    this.#process.kill();
  }
}

function runtimePaths(): { readonly aiRuntime: string; readonly dataCore: string } {
  if (app.isPackaged) {
    return {
      aiRuntime: join(process.resourcesPath, "dist", "index.cjs"),
      dataCore: join(process.resourcesPath, "bubu-data-core"),
    };
  }
  const repositoryRoot = resolve(app.getAppPath(), "..", "..");
  return {
    aiRuntime: join(repositoryRoot, "services", "ai-runtime", "dist", "index.cjs"),
    dataCore: join(repositoryRoot, "services", "data-core", "bin", "bubu-data-core"),
  };
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
  importFiles(sourcePaths: readonly string[]): Promise<DatasetImportResult>;
  listDatasets(): Promise<readonly DatasetSummary[]>;
  previewDataset(request: DatasetPreviewRequest): Promise<DatasetPreview>;
  replaceDataset(datasetID: string, sourcePath: string): Promise<DatasetReplacementResult>;
  modelContext(datasetID: string, disclosure: DisclosureLevel): Promise<ModelContext>;
  generateModel(invocation: ModelInvocation): Promise<ModelCompletion>;
  executeQueryPlan(plan: SafeQueryPlan): Promise<SafeQueryResult>;
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
    async importFiles(sourcePaths) {
      return dataCore.importFiles(sourcePaths);
    },
    listDatasets: () => dataCore.listDatasets(),
    previewDataset: (request) => dataCore.preview(request),
    replaceDataset: (datasetID, sourcePath) => dataCore.replaceFile(datasetID, sourcePath),
    modelContext: (datasetID, disclosure) => dataCore.modelContext(datasetID, disclosure),
    generateModel: (invocation) => aiRuntime.generate(invocation),
    executeQueryPlan: (plan) => dataCore.executeQueryPlan(plan),
    listGroups: () => dataCore.listGroups(),
    saveGroup: (input) => dataCore.saveGroup(input),
    deleteGroup: (groupID) => dataCore.deleteGroup(groupID),
    stop() {
      aiRuntime.stop();
      dataCore.stop();
    },
  };
}
