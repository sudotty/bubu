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
}
