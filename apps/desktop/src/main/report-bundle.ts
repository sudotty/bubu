import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { ReportBundleExportResult, ReportBundleInput, ReportTable } from "@bubu/contracts";
import { strToU8, zipSync } from "fflate";

type ReportValue = ReportTable["rows"][number][number];
type PdfRenderer = (htmlPath: string, pdfPath: string) => Promise<void>;

function xml(value: unknown): string { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }
function html(value: unknown): string { return xml(value); }
function safeCell(value: ReportValue): string { const text = value === null ? "" : String(value); return /^[=+\-@]/u.test(text) ? `'${text}` : text; }
function csvCell(value: ReportValue): string { const text = safeCell(value); return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function reportCsv(table: ReportTable): string { return [table.columns.map(csvCell), ...table.rows.map((row) => row.map(csvCell))].map((row) => row.join(",")).join("\r\n"); }

function factList(facts: ReportBundleInput["deterministicFacts"]): string { return facts.length === 0 ? '<p class="empty">无</p>' : `<dl>${facts.map((fact) => `<div><dt>${html(fact.label)}</dt><dd>${html(fact.value)}</dd></div>`).join("")}</dl>`; }
function textList(values: readonly string[]): string { return values.length === 0 ? '<p class="empty">无</p>' : `<ul>${values.map((value) => `<li>${html(value)}</li>`).join("")}</ul>`; }
export function reportHtml(input: ReportBundleInput): string {
  const tables = input.tables.map((table) => `<section><h2>${html(table.name)}</h2><div class="table"><table><thead><tr>${table.columns.map((column) => `<th scope="col">${html(column)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((value) => `<td>${html(safeCell(value))}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`).join("");
  const styles = [
    "@page{size:A4;margin:14mm}",
    "*{box-sizing:border-box}",
    'body{max-width:1100px;margin:32px auto;padding:0 24px;font:14px/1.55 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#282520;background:#faf8f3}',
    "header{padding-bottom:20px;border-bottom:2px solid #2f5d50}",
    "h1{margin:0 0 6px;font-size:28px}",
    "h2{margin:24px 0 10px;font-size:18px}",
    "p{color:#625d55}",
    "dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}",
    "dl div{min-width:0;padding:9px;border:1px solid #ded8ce;border-radius:8px;background:#fff}",
    "dt{font-size:12px;color:#706a61}",
    "dd{margin:2px 0 0;font-weight:650;overflow-wrap:anywhere}",
    ".table{overflow:auto;border:1px solid #d8d1c5;border-radius:10px;background:#fff}",
    "table{width:100%;border-collapse:collapse}",
    "th,td{padding:8px 9px;border-bottom:1px solid #e7e1d8;text-align:left;white-space:nowrap}",
    "th{background:#f2eee6}",
    ".model{padding:12px;border-left:4px solid #9a825b;background:#fff8e8}",
    ".model strong{display:block}",
    ".model small{color:#725f42}",
    ".empty,footer{font-size:12px;color:#777}",
    "@media print{body{margin:0;padding:0;background:#fff}.table{overflow:visible}thead{display:table-header-group}th,td{white-space:normal;overflow-wrap:anywhere}}",
  ].join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${html(input.title)}</title><style>${styles}</style></head><body><header><small>BuBu 专业证据报告 · ${html(input.kind)}</small><h1>${html(input.title)}</h1><p>${html(input.summary)}</p></header><main><section><h2>确定性事实</h2>${factList(input.deterministicFacts)}</section><section><h2>质量证明</h2>${factList(input.quality)}</section>${tables}<section><h2>异常与未决事项</h2>${textList(input.exceptions)}</section><section><h2>限制</h2>${textList(input.limitations)}</section><section><h2>血缘</h2>${factList(input.lineage)}</section><section><h2>运行元数据</h2>${factList(input.runMetadata)}</section>${input.modelNarrative ? `<section class="model"><strong>模型叙述（非权威）</strong><small>以下文字不能覆盖确定性事实、控制总额或审批证据。</small><p>${html(input.modelNarrative)}</p></section>` : ""}</main><footer>报告在本地确定性生成；机器可读 manifest 包含每个交付文件的 SHA-256。</footer></body></html>`;
}

function columnName(index: number): string { let value = index + 1; let result = ""; while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); } return result; }
function worksheetCell(value: ReportValue, row: number, column: number, style: number): string {
  const reference = `${columnName(column)}${row}`;
  if (value === null) return `<c r="${reference}" s="${style}"/>`;
  if (typeof value === "number") return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${reference}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(safeCell(value))}</t></is></c>`;
}
function displayWidth(value: ReportValue): number { return [...safeCell(value)].reduce((total, character) => total + (character.codePointAt(0)! > 0xff ? 2 : 1), 0); }
function worksheet(rows: readonly (readonly ReportValue[])[], summary: boolean): string {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const lastCell = `${columnName(columnCount - 1)}${Math.max(1, rows.length)}`;
  const widths = summary
    ? [28, 72]
    : Array.from({ length: columnCount }, (_value, columnIndex) => Math.min(48, Math.max(12, ...rows.map((row) => displayWidth(row[columnIndex] ?? null) + 2))));
  const columns = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const sheetRows = rows.map((values, rowIndex) => {
    const height = rowIndex === 0 ? (summary ? 30 : 26) : values.some((value, index) => displayWidth(value) > (widths[index] ?? 12)) ? 36 : 22;
    const cells = values.map((value, columnIndex) => {
      const style = rowIndex === 0 ? (summary ? 1 : 2) : summary && columnIndex === 0 ? 3 : typeof value === "number" ? 5 : typeof value === "boolean" ? 6 : 4;
      return worksheetCell(value, rowIndex + 1, columnIndex, style);
    }).join("");
    return `<row r="${rowIndex + 1}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("");
  const autoFilter = summary || rows.length === 0 ? "" : `<autoFilter ref="A1:${lastCell}"/>`;
  const orientation = columnCount > 4 ? "landscape" : "portrait";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>${columns}</cols><sheetData>${sheetRows}</sheetData>${autoFilter}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="${orientation}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
const workbookStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><color rgb="FF282520"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF2F5D50"/><name val="Aptos"/><family val="2"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F5D50"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F0EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD9E0DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
function safeSheetName(value: string, used: Set<string>): string { const base = value.replaceAll(/[\\/*?:\[\]]/gu, "-").trim().slice(0, 31) || "Sheet"; let candidate = base; let suffix = 2; while (used.has(candidate.toLocaleLowerCase("en-US"))) { const ending = `-${suffix++}`; candidate = `${base.slice(0, 31 - ending.length)}${ending}`; } used.add(candidate.toLocaleLowerCase("en-US")); return candidate; }
export function reportWorkbook(input: ReportBundleInput): Uint8Array {
  const summaryRows: ReportValue[][] = [["BuBu 确定性报告", input.title], ["类型", input.kind], ["摘要", input.summary], ...input.deterministicFacts.map(({ label, value }) => [label, value]), ...input.quality.map(({ label, value }) => [`质量 · ${label}`, value]), ...input.lineage.map(({ label, value }) => [`血缘 · ${label}`, value]), ...input.runMetadata.map(({ label, value }) => [`运行 · ${label}`, value])];
  const sheetRows = [summaryRows, ...input.tables.map((table) => [table.columns, ...table.rows])];
  const used = new Set<string>(); const names = [safeSheetName("Summary", used), ...input.tables.map(({ name }) => safeSheetName(name, used))];
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_name, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, index) => `<sheet name="${xml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`;
  const workbookRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_name, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const files: Record<string, Uint8Array> = { "[Content_Types].xml": strToU8(contentTypes), "_rels/.rels": strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'), "xl/workbook.xml": strToU8(workbook), "xl/styles.xml": strToU8(workbookStyles), "xl/_rels/workbook.xml.rels": strToU8(workbookRelationships) };
  sheetRows.forEach((rows, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheet(rows, index === 0)); });
  return zipSync(files, { level: 6 });
}

export function safeReportName(title: string): string { return title.replaceAll(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").replaceAll(/\s+/gu, " ").replaceAll(/[. ]+$/gu, "").trim().slice(0, 180) || "bubu-report"; }
async function availableTarget(parent: string, base: string): Promise<string> { for (let index = 1; index <= 100; index += 1) { const name = index === 1 ? `${base}-bubu-report` : `${base}-bubu-report-${index}`; const target = join(parent, name); try { await access(target); } catch { return target; } } throw new Error("Too many report bundles share the same name"); }
const hash = (value: Uint8Array | Buffer | string) => createHash("sha256").update(value).digest("hex");

export async function writeReportBundle(input: ReportBundleInput, parentDirectory: string, renderPdf: PdfRenderer, now: () => Date = () => new Date()): Promise<Extract<ReportBundleExportResult, { status: "exported" }>> {
  await mkdir(parentDirectory, { recursive: true });
  const target = await availableTarget(parentDirectory, safeReportName(input.title));
  const temporary = await mkdtemp(join(parentDirectory, `.${basename(target)}-`));
  try {
    const htmlName = "report.html"; const pdfName = "report.pdf"; const workbookName = "report.xlsx";
    await writeFile(join(temporary, htmlName), reportHtml(input), { encoding: "utf8", mode: 0o600 });
    await writeFile(join(temporary, workbookName), reportWorkbook(input), { mode: 0o600 });
    const csvNames: string[] = [];
    for (const [index, table] of input.tables.entries()) { const csvName = `${String(index + 1).padStart(2, "0")}-${safeReportName(table.name)}.csv`; csvNames.push(csvName); await writeFile(join(temporary, csvName), `\uFEFF${reportCsv(table)}`, { encoding: "utf8", mode: 0o600 }); }
    await renderPdf(join(temporary, htmlName), join(temporary, pdfName));
    const names = [htmlName, pdfName, workbookName, ...csvNames];
    const files = await Promise.all(names.map(async (name) => { const contents = await readFile(join(temporary, name)); return { name, bytes: contents.byteLength, sha256: hash(contents) }; }));
    const manifest = { schemaVersion: 1, kind: input.kind, title: input.title, generatedAt: now().toISOString(), factAuthority: "deterministic-local", modelNarrative: input.modelNarrative ? "separate-non-authoritative-section" : "absent", tableCount: input.tables.length, rowCount: input.tables.reduce((total, table) => total + table.rows.length, 0), files } as const;
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(join(temporary, "manifest.json"), manifestText, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
    return { status: "exported", bundleName: basename(target), fileCount: names.length + 1, manifestSha256: hash(manifestText) };
  } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
}
