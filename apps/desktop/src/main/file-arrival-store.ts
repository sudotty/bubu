import { createHash } from "node:crypto";
import { watch } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { parseFileArrivalState, type DatasetPreview, type DatasetSummary, type FileArrivalItem, type FileArrivalState, type SourceInspection } from "@bubu/contracts";
import { recommendFileArrivalTargets } from "@bubu/product-core";

interface PrivateArrival extends FileArrivalItem { readonly sourcePath: string; readonly signature: string; readonly size: number; readonly modifiedAtMs: number }
interface PersistedState { readonly folderPath?: string; readonly watchError?: string; readonly items: readonly PrivateArrival[] }
interface DirectoryWatcher { close(): void }
interface FileArrivalStoreOptions {
  readonly directory: string;
  readonly now: () => Date;
  readonly newId: () => string;
  readonly listDatasets: () => Promise<readonly DatasetSummary[]>;
  readonly inspectSource?: (sourcePath: string) => Promise<SourceInspection>;
  readonly previewDataset?: (datasetId: string) => Promise<DatasetPreview>;
  readonly watchDirectory?: (path: string, listener: (fileName: string | null) => void) => DirectoryWatcher;
  readonly onDetected?: (item: FileArrivalItem) => Promise<void>;
}

export interface FileArrivalStore {
  configure(folderPath: string): Promise<FileArrivalState>;
  state(): Promise<FileArrivalState>;
  recordFile(sourcePath: string): Promise<FileArrivalState>;
  source(arrivalId: string): Promise<{ readonly sourcePath: string; readonly item: FileArrivalItem }>;
  update(arrivalId: string, values: Pick<FileArrivalItem, "status"> & { readonly message?: string; readonly selectedDatasetId?: string; readonly candidates?: FileArrivalItem["candidates"] }): Promise<FileArrivalState>;
  dismiss(arrivalId: string): Promise<FileArrivalState>;
}

const supportedExtensions = new Set([".csv", ".tsv", ".xlsx"]);

function publicState(value: PersistedState): FileArrivalState {
  return parseFileArrivalState({
    configured: value.folderPath !== undefined,
    watchStatus: value.folderPath === undefined ? "inactive" : value.watchError ? "unavailable" : "active",
    ...(value.folderPath ? { folderLabel: basename(value.folderPath) } : {}),
    ...(value.watchError ? { watchMessage: value.watchError } : {}),
    items: value.items.map(({ sourcePath: _sourcePath, signature: _signature, size: _size, modifiedAtMs: _modifiedAtMs, ...item }) => item),
  });
}

function parsePersisted(value: unknown): PersistedState {
  if (!value || typeof value !== "object") throw new Error("File arrival state must be an object");
  const candidate = value as { folderPath?: unknown; watchError?: unknown; items?: unknown };
  if (candidate.folderPath !== undefined && (typeof candidate.folderPath !== "string" || !isAbsolute(candidate.folderPath))) throw new Error("File arrival folder path is invalid");
  if (candidate.watchError !== undefined && (typeof candidate.watchError !== "string" || candidate.watchError.length < 1 || candidate.watchError.length > 500)) throw new Error("File arrival watcher error is invalid");
  if (!Array.isArray(candidate.items)) throw new Error("File arrival items are invalid");
  const privateItems = candidate.items.map((item) => {
    if (!item || typeof item !== "object") throw new Error("File arrival item is invalid");
    const privateItem = item as Record<string, unknown>;
    if (typeof privateItem.sourcePath !== "string" || !isAbsolute(privateItem.sourcePath) || typeof privateItem.signature !== "string" || typeof privateItem.size !== "number" || typeof privateItem.modifiedAtMs !== "number") throw new Error("File arrival private item is invalid");
    const { sourcePath, signature, size, modifiedAtMs, ...publicItem } = privateItem;
    const parsed = parseFileArrivalState({ configured: true, folderLabel: "validated", items: [publicItem] }).items[0];
    if (!parsed) throw new Error("File arrival item is missing");
    return { ...parsed, sourcePath, signature, size, modifiedAtMs } as PrivateArrival;
  });
  return { ...(candidate.folderPath ? { folderPath: resolve(candidate.folderPath) } : {}), ...(candidate.watchError ? { watchError: candidate.watchError } : {}), items: privateItems.slice(0, 100) };
}

export function createFileArrivalStore(options: FileArrivalStoreOptions): FileArrivalStore {
  const statePath = join(options.directory, "file-arrivals.json");
  let current: PersistedState = { items: [] };
  let loaded = false;
  let watcher: DirectoryWatcher | undefined;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const load = async () => {
    if (loaded) return;
    loaded = true;
    try { current = parsePersisted(JSON.parse(await readFile(statePath, "utf8")) as unknown); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  const persist = async () => {
    await mkdir(options.directory, { recursive: true });
    const temporary = `${statePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, statePath);
  };
  const defaultWatch = (folderPath: string, listener: (fileName: string | null) => void): DirectoryWatcher => {
    const value = watch(folderPath, { persistent: false }, (_event, fileName) => listener(fileName?.toString() ?? null));
    value.on("error", () => { current = { ...current, watchError: "文件夹权限或监听已失效；请重新批准周期文件夹。" }; void persist().catch(() => undefined); });
    return value;
  };
  const startWatch = () => {
    watcher?.close(); watcher = undefined;
    if (!current.folderPath) return;
    watcher = (options.watchDirectory ?? defaultWatch)(current.folderPath, (fileName) => {
      if (!fileName || !supportedExtensions.has(extname(fileName).toLocaleLowerCase("en-US"))) return;
      const sourcePath = join(current.folderPath as string, basename(fileName));
      const existing = timers.get(sourcePath); if (existing) clearTimeout(existing);
      timers.set(sourcePath, setTimeout(() => { timers.delete(sourcePath); void recordFile(sourcePath).catch(() => undefined); }, 1_200));
    });
  };
  const recordFile = async (sourcePath: string): Promise<FileArrivalState> => {
    await load();
    if (!current.folderPath || resolve(dirname(sourcePath)) !== resolve(current.folderPath)) throw new Error("File is outside the approved folder");
    if (!supportedExtensions.has(extname(sourcePath).toLocaleLowerCase("en-US"))) throw new Error("File type is not supported for arrival recognition");
    const metadata = await stat(sourcePath);
    if (!metadata.isFile() || metadata.size === 0) throw new Error("Arriving file is empty or is not a regular file");
    const signature = createHash("sha256").update(`${resolve(sourcePath)}\0${metadata.size}\0${metadata.mtimeMs}`).digest("hex");
    if (current.items.some((item) => item.signature === signature)) return publicState(current);
    const datasets = await options.listDatasets();
    let candidates = recommendFileArrivalTargets(basename(sourcePath), datasets);
    if (options.inspectSource && options.previewDataset && candidates.length > 0) {
      const [inspection, previews] = await Promise.all([options.inspectSource(sourcePath), Promise.all(candidates.map(({ datasetId }) => options.previewDataset?.(datasetId)))]);
      candidates = recommendFileArrivalTargets(basename(sourcePath), datasets, inspection, previews.flatMap((preview) => preview ? [{ datasetId: preview.datasetId, columns: preview.columns.map(({ name }) => name), rowCount: preview.totalRows }] : []));
    }
    const item: PrivateArrival = {
      id: options.newId(), fileName: basename(sourcePath), detectedAt: options.now().toISOString(), status: "needs-review", candidates: [...candidates],
      ...(candidates.length === 0 ? { message: "没有找到兼容的数据对象，请先导入或选择其他文件。" } : {}), sourcePath: resolve(sourcePath), signature, size: metadata.size, modifiedAtMs: metadata.mtimeMs,
    };
    current = { ...current, items: [item, ...current.items].slice(0, 100) };
    await persist();
    await options.onDetected?.(publicState(current).items[0] as FileArrivalItem);
    return publicState(current);
  };

  return {
    async configure(folderPath) {
      await load();
      const absolute = resolve(folderPath); const metadata = await stat(absolute).catch(async (error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") { await mkdir(absolute, { recursive: true }); return stat(absolute); } throw error; });
      if (!metadata.isDirectory()) throw new Error("Approved arrival location must be a folder");
      current = { folderPath: absolute, items: current.items.filter((item) => dirname(item.sourcePath) === absolute) };
      await persist(); startWatch(); return publicState(current);
    },
    async state() { await load(); if (current.folderPath && !watcher) startWatch(); return publicState(current); },
    recordFile,
    async source(arrivalId) { await load(); const item = current.items.find(({ id }) => id === arrivalId); if (!item) throw new Error("File arrival item was not found"); const metadata = await stat(item.sourcePath); if (!metadata.isFile() || metadata.size !== item.size || metadata.mtimeMs !== item.modifiedAtMs) throw new Error("Arriving file changed after detection; wait for copying to finish and review the new event"); const { sourcePath, signature: _signature, size: _size, modifiedAtMs: _modifiedAtMs, ...publicItem } = item; return { sourcePath, item: publicItem }; },
    async update(arrivalId, values) { await load(); let found = false; current = { ...current, items: current.items.map((item) => item.id === arrivalId ? (found = true, { ...item, ...values }) : item) }; if (!found) throw new Error("File arrival item was not found"); await persist(); return publicState(current); },
    async dismiss(arrivalId) { return this.update(arrivalId, { status: "dismissed", message: "已忽略；不会创建数据版本或触发周期任务。" }); },
  };
}
