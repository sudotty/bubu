import { writeFile } from "node:fs/promises";
import { clipboard, dialog, ipcMain } from "electron";
import { parseArtifactTableActionInput, type ArtifactTableActionInput } from "@bubu/contracts";
import { desktopChannels } from "../shared/product-api.js";

function safeCell(value: ArtifactTableActionInput["rows"][number][number]): string {
  const text = value === null ? "" : String(value);
  return /^[=+\-@]/u.test(text) ? `'${text}` : text;
}

function csvCell(value: ArtifactTableActionInput["rows"][number][number]): string {
  const text = safeCell(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function artifactCsv(input: ArtifactTableActionInput): string {
  return [input.columns.map(csvCell), ...input.rows.map((row) => row.map(csvCell))]
    .map((row) => row.join(","))
    .join("\r\n");
}

export function artifactTsv(input: ArtifactTableActionInput): string {
  return [input.columns, ...input.rows]
    .map((row) => row.map((value) => safeCell(value).replaceAll("\t", " ").replaceAll(/\r?\n/gu, " ")).join("\t"))
    .join("\n");
}

export function artifactFileName(title: string): string {
  const safe = title.replaceAll(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").replaceAll(/\s+/gu, " ").replaceAll(/[. ]+$/gu, "").trim();
  return `${safe || "bubu-result"}.csv`;
}

function html(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function artifactHtmlReport(input: ArtifactTableActionInput): string {
  const head = input.columns.map((column) => `<th scope="col">${html(column)}</th>`).join("");
  const body = input.rows.map((row) => `<tr>${row.map((cell) => `<td>${html(cell)}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${html(input.title)}</title><style>body{max-width:1100px;margin:40px auto;padding:0 24px;font:15px/1.6 system-ui;color:#292621;background:#faf8f3}header{margin-bottom:24px}h1{margin:0 0 6px}p{color:#6f685e}.table{overflow:auto;border:1px solid #d8d1c5;border-radius:12px;background:#fff}table{width:100%;border-collapse:collapse}th,td{padding:9px 11px;border-bottom:1px solid #e7e1d8;text-align:left;white-space:nowrap}th{background:#f2eee6}footer{margin-top:18px;font-size:12px;color:#777}</style></head><body><header><h1>${html(input.title)}</h1><p>BuBu 本地轻报告 · ${input.rows.length} 行 · ${input.columns.length} 列</p></header><main class="table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></main><footer>此文件由本地 Artifact 当前结果生成，不包含模型凭据、文件路径或未显示的数据行。</footer></body></html>`;
}

export function registerArtifactApi({ assertTrustedSender }: { readonly assertTrustedSender: (frameUrl: string) => void }): void {
  ipcMain.handle(desktopChannels.copyArtifactTable, (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseArtifactTableActionInput(value);
    clipboard.writeText(artifactTsv(input));
    return { status: "copied", rowCount: input.rows.length } as const;
  });
  ipcMain.handle(desktopChannels.exportArtifactTable, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseArtifactTableActionInput(value);
    const selection = await dialog.showSaveDialog({ title: "导出当前结果视图", defaultPath: artifactFileName(input.title), filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (selection.canceled || !selection.filePath) return { status: "cancelled" } as const;
    await writeFile(selection.filePath, `\uFEFF${artifactCsv(input)}`, { encoding: "utf8", mode: 0o600 });
    return { status: "exported", rowCount: input.rows.length } as const;
  });
  ipcMain.handle(desktopChannels.exportArtifactReport, async (event, value: unknown) => {
    assertTrustedSender(event.senderFrame?.url ?? "");
    const input = parseArtifactTableActionInput(value);
    const selection = await dialog.showSaveDialog({ title: "导出本地轻报告", defaultPath: artifactFileName(input.title).replace(/\.csv$/u, ".html"), filters: [{ name: "HTML 报告", extensions: ["html"] }] });
    if (selection.canceled || !selection.filePath) return { status: "cancelled" } as const;
    await writeFile(selection.filePath, artifactHtmlReport(input), { encoding: "utf8", mode: 0o600 });
    return { status: "exported", rowCount: input.rows.length } as const;
  });
}
