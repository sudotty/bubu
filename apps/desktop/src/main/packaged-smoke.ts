import { basename, join } from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app, type BrowserWindow } from "electron";
import type { SidecarSupervisor } from "./sidecars.js";
import type { FileArrivalStore } from "./file-arrival-store.js";
import { renderReportPdf } from "./artifact-api.js";
import { writeReportBundle } from "./report-bundle.js";

let smokeModelServer: Server | undefined;

export async function startSmokeModelServer(): Promise<string> {
  const server = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => { body += chunk; });
    request.on("end", () => {
      try {
        const requestBody = JSON.parse(body) as { readonly messages?: readonly { readonly content?: string }[] };
        const userMessage = requestBody.messages?.at(-1)?.content ?? "{}";
        const systemMessages = requestBody.messages?.map(({ content }) => content ?? "") ?? [];
        const knowledgeRequest = systemMessages.some((content) => content.includes("retrieved local document chunks"));
        const mcpPromptRequest = systemMessages.some((content) => content.includes("explicitly disclosed MCP prompt result"));
        const mcpToolRequest = systemMessages.some((content) => content.includes("explicitly disclosed MCP tool catalog"));
        const disclosed = JSON.parse(userMessage) as { readonly columns?: readonly string[]; readonly rows?: readonly { readonly rowNumber?: number }[]; readonly citations?: readonly { readonly chunkId?: string }[] };
        const content = mcpPromptRequest
          ? JSON.stringify({ schemaVersion: 1, response: "Gross margin is explained from the explicitly approved local MCP prompt." })
          : mcpToolRequest
            ? JSON.stringify({ schemaVersion: 1, toolName: "lookup_term", arguments: { term: "gross_margin" } })
            : knowledgeRequest
              ? JSON.stringify({ schemaVersion: 1, answer: "退款需要订单号与购买凭证，并应在购买后 30 天内提交。", citations: [{ chunkId: disclosed.citations?.[0]?.chunkId }] })
              : JSON.stringify({ schemaVersion: 1, summary: "已仅根据明确选择的单元格生成解释。", findings: [{ title: "受审单元格", detail: "该结论只引用本次一次性批准的单元格。", evidence: [{ rowNumber: disclosed.rows?.[0]?.rowNumber ?? 1, column: disclosed.columns?.[0] ?? "unknown" }] }], caveats: ["未披露行不在结论范围内。"] });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ id: "smoke", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { prompt_tokens: 20, completion_tokens: 20, total_tokens: 40 } }));
      } catch (error) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : "invalid smoke request" } }));
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  server.unref();
  smokeModelServer = server;
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/v1`;
}


async function captureSmokeStep(
  window: BrowserWindow,
  screenshotDirectory: string | undefined,
  fileName: string,
): Promise<void> {
  if (!screenshotDirectory) return;
  await mkdir(screenshotDirectory, { recursive: true });
  const image = await window.webContents.capturePage();
  await writeFile(join(screenshotDirectory, fileName), image.toPNG(), { mode: 0o600 });
}

async function verifySmokeLayout(window: BrowserWindow, screen: string): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    (() => {
      const selectors = ["html", "body", ".shell", ".workspace", ".conversation", ".conversation-workbench"];
      const measurements = selectors.flatMap((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return [];
        return [{
          selector,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }];
      });
      return {
        viewportWidth: window.innerWidth,
        overflowing: measurements.filter(({ clientWidth, scrollWidth }) => scrollWidth - clientWidth > 1),
      };
    })()
  `) as {
    readonly viewportWidth: number;
    readonly overflowing: readonly {
      readonly selector: string;
      readonly clientWidth: number;
      readonly scrollWidth: number;
    }[];
  };
  if (result.viewportWidth !== 920 || result.overflowing.length > 0) {
    throw new Error(
      `Packaged renderer layout failed on ${screen}: ${JSON.stringify(result)}`,
    );
  }
}

export async function verifyPackagedAccessibility(window: BrowserWindow): Promise<void> {
  const semantic = await window.webContents.executeJavaScript(`
    (() => {
      const visible = (element) => element instanceof HTMLElement && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
      const name = (element) => (element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "").trim();
      const unnamedButtons = Array.from(document.querySelectorAll("button, a[href]")).filter((element) => visible(element) && name(element).length === 0);
      const unnamedInputs = Array.from(document.querySelectorAll("input, select, textarea")).filter((element) => {
        if (!visible(element) || element.getAttribute("type") === "hidden") return false;
        const id = element.getAttribute("id");
        return !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !element.closest("label") && !(id && document.querySelector('label[for="' + CSS.escape(id) + '"]'));
      });
      const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      return { unnamedButtons: unnamedButtons.length, unnamedInputs: unnamedInputs.length, duplicateIds: [...new Set(duplicateIds)], hasMain: Boolean(document.querySelector("main, [role=main], .workspace")), hasHeading: Boolean(document.querySelector("h1, h2")) };
    })()
  `) as { readonly unnamedButtons: number; readonly unnamedInputs: number; readonly duplicateIds: readonly string[]; readonly hasMain: boolean; readonly hasHeading: boolean };
  if (semantic.unnamedButtons > 0 || semantic.unnamedInputs > 0 || semantic.duplicateIds.length > 0 || !semantic.hasMain || !semantic.hasHeading) {
    throw new Error(`Packaged accessibility semantics failed: ${JSON.stringify(semantic)}`);
  }
  window.webContents.setZoomFactor(2);
  const reflow = await window.webContents.executeJavaScript(`new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve({ viewport: innerWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }))))`) as { readonly viewport: number; readonly overflow: number };
  window.webContents.setZoomFactor(1);
  if (reflow.overflow > 1) throw new Error(`Packaged 200% zoom reflow failed: ${JSON.stringify(reflow)}`);
  console.log("BUBU_PACKAGED_ACCESSIBILITY_OK");
}

export async function verifyPackagedConfigurationJourney(window: BrowserWindow, screenshotDirectory?: string): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const settings = document.querySelector('.rail-item[aria-label="设置"]');
      if (!(settings instanceof HTMLButtonElement)) return resolve({ ok: false, stage: "settings-navigation" });
      settings.click();
      const deadline = Date.now() + 10000; let privacyOpened = false; let exported = false; let changed = false; let restored = false;
      const inspect = async () => {
        const settingsRoot = document.querySelector(".settings-workbench");
        if (!privacyOpened) {
          const privacy = Array.from(settingsRoot?.querySelectorAll(".settings-nav button") ?? []).find((button) => button.textContent?.includes("隐私与恢复"));
          if (privacy instanceof HTMLButtonElement) { privacyOpened = true; privacy.click(); return setTimeout(inspect, 80); }
        }
        const panel = document.querySelector(".data-protection-panel"); const text = panel?.textContent ?? "";
        if (privacyOpened && !exported) {
          const button = Array.from(panel?.querySelectorAll("button") ?? []).find((item) => item.textContent?.includes("导出产品设置"));
          if (button instanceof HTMLButtonElement && !button.disabled) { exported = true; button.click(); return setTimeout(inspect, 80); }
        }
        if (exported && text.includes("已导出") && !changed) {
          changed = true; await window.bubu.privacyPolicy.save({ schemaVersion: 1, mode: "strict-private", localDlpEnabled: true });
          const button = Array.from(panel?.querySelectorAll("button") ?? []).find((item) => item.textContent?.includes("恢复产品设置"));
          if (button instanceof HTMLButtonElement && !button.disabled) { button.click(); return setTimeout(inspect, 80); }
        }
        if (changed && text.includes("恢复设置") && text.includes("重新创建并授权")) {
          const policy = await window.bubu.privacyPolicy.get(); restored = policy.mode === "local-private";
          return resolve({ ok: restored, stage: "restored", mode: policy.mode });
        }
        if (Date.now() >= deadline) return resolve({ ok: false, stage: "timeout", text });
        setTimeout(inspect, 80);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string; readonly mode?: string };
  if (!result.ok) throw new Error(`Packaged configuration journey failed: ${JSON.stringify(result)}`);
  await verifySmokeLayout(window, "privacy and recovery settings");
  await captureSmokeStep(window, screenshotDirectory, "03-privacy-recovery.png");
  await window.webContents.executeJavaScript(`document.querySelector('.rail-item[aria-label="数据对象"]')?.click()`);
  console.log("BUBU_PACKAGED_CONFIGURATION_BACKUP_OK");
}

export async function verifyPackagedKnowledgeRenderer(window: BrowserWindow): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const open = Array.from(document.querySelectorAll(".rail-item")).find((button) => button.getAttribute("aria-label") === "业务知识");
      if (!(open instanceof HTMLButtonElement)) return resolve({ ok: false, stage: "navigation" });
      open.click();
      const deadline = Date.now() + 12000;
      let searched = false;
      let prepared = false;
      let approved = false;
      const inspect = () => {
        const workbench = document.querySelector(".knowledge-workbench");
        if (!(workbench instanceof HTMLElement)) {
          if (Date.now() >= deadline) return resolve({ ok: false, stage: "workspace", text: document.body.textContent });
          return setTimeout(inspect, 50);
        }
        const textarea = workbench.querySelector("textarea");
        const purpose = workbench.querySelector('input[placeholder*="客服"]');
        const buttons = Array.from(workbench.querySelectorAll("button"));
        if (!searched && textarea instanceof HTMLTextAreaElement && purpose instanceof HTMLInputElement) {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "退款需要哪些材料和期限");
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(purpose, "回答客服的退款政策问题");
          purpose.dispatchEvent(new Event("input", { bubbles: true }));
          const search = buttons.find((button) => button.textContent?.includes("仅在本地检索"));
          if (search instanceof HTMLButtonElement) { searched = true; search.click(); return setTimeout(inspect, 80); }
        }
        if (searched && !prepared && workbench.textContent?.includes("订单号与购买凭证") && workbench.textContent.includes("第 1–4 行")) {
          const prepare = buttons.find((button) => button.textContent?.includes("审查引用后回答"));
          if (prepare instanceof HTMLButtonElement) { prepared = true; prepare.click(); return setTimeout(inspect, 80); }
        }
        const approval = workbench.querySelector(".knowledge-approval");
        if (prepared && !approved && approval?.textContent?.includes("一次性知识披露审查") && approval.textContent.includes("SHA-256")) {
          const approve = Array.from(approval.querySelectorAll("button")).find((button) => button.textContent?.includes("批准一次并生成回答"));
          if (approve instanceof HTMLButtonElement) { approved = true; approve.click(); return setTimeout(inspect, 80); }
        }
        const answer = workbench.querySelector(".knowledge-answer");
        if (approved && answer?.textContent?.includes("退款需要订单号与购买凭证") && answer.textContent.includes("查看引用")) return resolve({ ok: true, stage: "completed" });
        if (Date.now() >= deadline) return resolve({ ok: false, stage: approved ? "answer" : prepared ? "approval" : searched ? "retrieval" : "form", text: workbench.textContent });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!result.ok) throw new Error(`Packaged local knowledge failed at ${result.stage}: ${result.text ?? ""}`);
  await verifySmokeLayout(window, "local knowledge");
  console.log("BUBU_PACKAGED_LOCAL_RAG_OK");
}

export async function verifyPackagedMcpModelRenderer(window: BrowserWindow): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 25000;
      let stage = "navigate";
      const setValue = (element, value) => {
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
        element.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const button = (root, text) => Array.from(root.querySelectorAll("button")).find((entry) => entry.textContent?.includes(text));
      const inspect = () => {
        if (Date.now() >= deadline) return resolve({ ok: false, stage, text: document.body.textContent });
        if (stage === "navigate") {
          const settings = document.querySelector('.rail-item[aria-label="设置"]');
          if (settings instanceof HTMLButtonElement) { settings.click(); stage = "connectors"; }
          return setTimeout(inspect, 50);
        }
        if (stage === "connectors") {
          const connectors = button(document, "本地连接器");
          if (connectors instanceof HTMLButtonElement) { connectors.click(); stage = "inspect-prepare"; }
          return setTimeout(inspect, 50);
        }
        const center = document.querySelector(".mcp-settings");
        if (!(center instanceof HTMLElement)) return setTimeout(inspect, 50);
        if (stage === "inspect-prepare") {
          const card = Array.from(center.querySelectorAll(".mcp-connection-card")).find((entry) => entry.textContent?.includes("BuBu 安全演示 MCP"));
          const prepare = card ? button(card, "审查并检查") : undefined;
          if (prepare instanceof HTMLButtonElement) { prepare.click(); stage = "inspect-approve"; }
          return setTimeout(inspect, 50);
        }
        if (stage === "inspect-approve") {
          const review = center.querySelector(".mcp-launch-review");
          const approve = review ? button(review, "批准启动一次并只检查能力") : undefined;
          if (approve instanceof HTMLButtonElement) { approve.click(); stage = "prompt-edit"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "prompt-edit") {
          const prompt = Array.from(center.querySelectorAll("details")).find((entry) => entry.textContent?.includes("解释业务术语"));
          const edit = prompt ? button(prompt, "填写参数并审查") : undefined;
          if (edit instanceof HTMLButtonElement) { edit.click(); stage = "prompt-prepare"; }
          return setTimeout(inspect, 50);
        }
        if (stage === "prompt-prepare") {
          const form = center.querySelector(".mcp-prompt-arguments");
          const input = form?.querySelector("input");
          if (form instanceof HTMLFormElement && input instanceof HTMLInputElement) { setValue(input, "gross_margin"); form.requestSubmit(); stage = "prompt-approve"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "prompt-approve") {
          const review = Array.from(center.querySelectorAll(".mcp-launch-review")).find((entry) => entry.textContent?.includes("精确提示获取"));
          const approve = review ? button(review, "批准启动一次并获取此提示") : undefined;
          if (approve instanceof HTMLButtonElement) { approve.click(); stage = "prompt-model-prepare"; }
          return setTimeout(inspect, 60);
        }
        const bridge = center.querySelector(".mcp-model-bridge");
        if (!(bridge instanceof HTMLElement)) return setTimeout(inspect, 50);
        if (stage === "prompt-model-prepare") {
          const area = bridge.querySelector("textarea");
          const prepare = button(bridge, "审查将发送给模型的精确提示");
          if (area instanceof HTMLTextAreaElement && prepare instanceof HTMLButtonElement) { setValue(area, "Explain the approved term"); prepare.click(); stage = "prompt-model-approve"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "prompt-model-approve") {
          const approve = button(bridge, "单独批准发送并生成响应");
          if (approve instanceof HTMLButtonElement) { approve.click(); stage = "tool-model-prepare"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "tool-model-prepare") {
          if (!bridge.textContent?.includes("Gross margin is explained")) return setTimeout(inspect, 50);
          const areas = bridge.querySelectorAll("textarea");
          const goal = areas.item(areas.length - 1);
          const prepare = button(bridge, "审查工具目录模型披露");
          if (goal instanceof HTMLTextAreaElement && prepare instanceof HTMLButtonElement) { setValue(goal, "Look up gross margin without modifying data"); prepare.click(); stage = "tool-model-approve"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "tool-model-approve") {
          const approve = button(bridge, "批准模型只提出一个调用");
          if (approve instanceof HTMLButtonElement) { approve.click(); stage = "tool-execute"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "tool-execute") {
          const approve = button(bridge, "明确批准并只执行这一次");
          if (approve instanceof HTMLButtonElement && bridge.textContent?.includes("gross_margin")) { approve.click(); stage = "completed"; }
          return setTimeout(inspect, 60);
        }
        if (stage === "completed" && bridge.textContent?.includes("synthetic business definition") && bridge.textContent.includes("结果未发送给模型")) return resolve({ ok: true, stage });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!result.ok) throw new Error(`Packaged MCP model bridge failed at ${result.stage}: ${result.text ?? ""}`);
  await verifySmokeLayout(window, "MCP model bridge");
  console.log("BUBU_PACKAGED_MCP_MODEL_OK");
}

export async function verifyPackagedRemoteMcpRenderer(window: BrowserWindow): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 8000;
      let submitted = false;
      const inspect = () => {
        const panel = document.querySelector(".remote-mcp-settings");
        if (!(panel instanceof HTMLElement)) {
          if (Date.now() >= deadline) return resolve({ ok: false, stage: "panel", text: document.body.textContent });
          return setTimeout(inspect, 50);
        }
        if (!submitted) {
          const form = panel.querySelector(".remote-mcp-grid form");
          const inputs = form?.querySelectorAll("input");
          if (form instanceof HTMLFormElement && inputs && inputs.length >= 2) {
            const set = (input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); };
            set(inputs[0], "Synthetic remote review"); set(inputs[1], "https://example.com/mcp"); submitted = true; form.requestSubmit();
          }
          return setTimeout(inspect, 50);
        }
        if (panel.textContent?.includes("Synthetic remote review") && panel.textContent.includes("DNS/redirect") && panel.textContent.includes("远程 MCP 追加式审计")) return resolve({ ok: true, stage: "saved" });
        if (Date.now() >= deadline) return resolve({ ok: false, stage: "save", text: panel.textContent });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!result.ok) throw new Error(`Packaged remote MCP UI failed at ${result.stage}: ${result.text ?? ""}`);
  await verifySmokeLayout(window, "remote MCP settings");
  console.log("BUBU_PACKAGED_REMOTE_MCP_OK");
}

export async function verifyPackagedHubRenderer(window: BrowserWindow): Promise<void> {
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const privacy = Array.from(document.querySelectorAll(".settings-nav button")).find((button) => button.textContent?.includes("隐私与恢复"));
      if (!(privacy instanceof HTMLButtonElement)) return resolve({ ok: false, stage: "navigation" });
      privacy.click(); const deadline = Date.now() + 8000; let submitted = false;
      const set = (input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); };
      const inspect = () => {
        const panel = document.querySelector(".hub-settings");
        if (!(panel instanceof HTMLElement)) return Date.now() >= deadline ? resolve({ ok: false, stage: "panel" }) : setTimeout(inspect, 50);
        if (!submitted) {
          const forms = panel.querySelectorAll("form"); const createInputs = forms.item(0)?.querySelectorAll("input"); const connectInputs = forms.item(1)?.querySelectorAll("input"); const role = forms.item(1)?.querySelector("select");
          if (createInputs?.item(0) && connectInputs && connectInputs.length >= 5 && role instanceof HTMLSelectElement) {
            set(createInputs.item(0), "https://hub.example.com/"); set(connectInputs.item(0), "a".repeat(32)); set(connectInputs.item(1), "b".repeat(32));
            Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(role, "editor"); role.dispatchEvent(new Event("change", { bubbles: true }));
            set(connectInputs.item(2), "synthetic-device-token".padEnd(32, "x")); set(connectInputs.item(3), "A".repeat(43)); set(connectInputs.item(4), "B".repeat(32)); submitted = true; forms.item(1).requestSubmit();
          }
          return setTimeout(inspect, 50);
        }
        if (panel.textContent?.includes("hub.example.com") && panel.textContent.includes("本地权限预检") && panel.textContent.includes("原始行") && panel.textContent.includes("审查精确摘要") && panel.textContent.includes("Outbox")) return resolve({ ok: true, stage: "configured" });
        if (Date.now() >= deadline) return resolve({ ok: false, stage: "configure", text: panel.textContent }); setTimeout(inspect, 50);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!result.ok) throw new Error(`Packaged Hub UI failed at ${result.stage}: ${result.text ?? ""}`);
  await verifySmokeLayout(window, "Hub settings"); console.log("BUBU_PACKAGED_HUB_SYNC_OK"); console.log("BUBU_PACKAGED_HUB_APPLICATION_ENTRY_OK");
}

export async function verifySmokeRenderer(
  window: BrowserWindow,
  smokeSidecars: SidecarSupervisor,
  sourcePath: string,
  driftSourcePath: string,
  screenshotDirectory?: string,
): Promise<void> {
  console.log("BUBU_PACKAGED_STAGE renderer-ready-check");
  window.webContents.focus();
  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const expected = [
        "synthetic-sales",
        "第一次使用",
        "用真实结构决定第一步",
        "3 行 · 4 列",
        "数据对话",
        "本地任务状态",
        "本地结果",
        "先生成计划",
        "之前的消息",
        "结果已准备好"
      ];
      const deadline = Date.now() + 5000;
      let selectedSales = false;
      const inspect = () => {
        if (!selectedSales) {
          const salesButton = Array.from(document.querySelectorAll("button.contact-card"))
            .find((button) => button.textContent?.includes("synthetic-sales"));
          if (salesButton instanceof HTMLButtonElement) {
            selectedSales = true;
            salesButton.click();
            setTimeout(inspect, 50);
            return;
          }
        }
        const contents = document.body.textContent ?? "";
        const visibleContents = document.body.innerText;
        const missing = expected.filter((value) => !contents.includes(value));
        const loading = ["正在读取本地预览与列画像…", "正在生成本地质量报告…"]
          .filter((value) => visibleContents.includes(value));
        if (missing.length === 0 && loading.length === 0) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!result.ok) {
    throw new Error(`Packaged renderer is missing imported data: ${result.missing.join(", ")}`);
  }
  console.log("BUBU_PACKAGED_ONBOARDING_OK");
  await verifyPackagedAccessibility(window);
  await verifyPackagedConfigurationJourney(window, screenshotDirectory);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const datasetMenu = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const trigger = document.querySelector(".dataset-menu-trigger");
      if (!(trigger instanceof HTMLButtonElement)) return resolve({ ok: false });
      trigger.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const menu = document.querySelector('.context-menu[aria-label*="数据对象菜单"]');
      const opened = menu?.textContent?.includes("替换为新文件") && menu.textContent.includes("永久删除数据对象");
      menu?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      resolve({ ok: Boolean(opened) && document.querySelector('.context-menu[aria-label*="数据对象菜单"]') === null });
    })
  `) as { readonly ok: boolean };
  if (!datasetMenu.ok) throw new Error("Packaged renderer data object action menu failed");
  const conversationLifecycle = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      try {
        const datasets = await window.bubu.datasets.list();
        const dataset = datasets.find((item) => item.displayName === "synthetic-sales");
        if (!dataset) return resolve({ ok: false, stage: "dataset" });
        const target = { kind: "dataset", id: dataset.id };
        const created = await window.bubu.conversations.create({ target, title: "Smoke 可删除归档任务" });
        await window.bubu.conversations.archive({ threadId: created.id, archived: true });
        const archived = (await window.bubu.conversations.list(target, true)).find((thread) => thread.id === created.id);
        if (!archived) return resolve({ ok: false, stage: "archive" });
        const deleted = await window.bubu.conversations.delete({ threadId: archived.id, expectedTitle: archived.title, expectedUpdatedAt: archived.updatedAt });
        const missing = await window.bubu.conversations.getById(created.id);
        const enabled = await window.bubu.conversations.saveRetentionPolicy({ schemaVersion: 1, enabled: true, retentionDays: 90 });
        const restored = await window.bubu.conversations.retentionPolicy();
        await window.bubu.conversations.saveRetentionPolicy({ schemaVersion: 1, enabled: false, retentionDays: 90 });
        resolve({ ok: deleted.reason === "manual" && missing === null && enabled.enabled && restored.enabled && restored.retentionDays === 90, stage: "completed" });
      } catch (error) {
        resolve({ ok: false, stage: "boundary", text: error instanceof Error ? error.message : String(error) });
      }
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!conversationLifecycle.ok) throw new Error(`Packaged conversation lifecycle failed at ${conversationLifecycle.stage}: ${conversationLifecycle.text ?? ""}`);
  console.log("BUBU_PACKAGED_CONVERSATION_RETENTION_OK");
  console.log("BUBU_PACKAGED_STAGE explicit-row-disclosure");
  await verifySmokeLayout(window, "dataset");
  await captureSmokeStep(window, screenshotDirectory, "01-datasets.png");
  const explicitRows = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const entry = document.querySelector(".explicit-row-entry");
      if (!(entry instanceof HTMLDetailsElement)) return resolve({ ok: false, stage: "entry" });
      entry.open = true;
      const deadline = Date.now() + 10000;
      let prepared = false;
      let approved = false;
      const inspect = () => {
        const panel = entry.querySelector(".explicit-row-panel");
        if (!(panel instanceof HTMLElement)) return resolve({ ok: false, stage: "panel" });
        if (!prepared) {
          const column = panel.querySelector('.explicit-row-column-picker input[type="checkbox"]');
          const row = panel.querySelector('.explicit-row-source-table tbody input[type="checkbox"]');
          const purpose = panel.querySelector("textarea");
          const prepare = Array.from(panel.querySelectorAll("button")).find((button) => button.textContent?.includes("生成精确披露预览"));
          if (column instanceof HTMLInputElement && row instanceof HTMLInputElement && purpose instanceof HTMLTextAreaElement && prepare instanceof HTMLButtonElement) {
            column.click(); row.click();
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(purpose, "解释这一条明确选择的记录");
            purpose.dispatchEvent(new Event("input", { bubbles: true }));
            prepared = true;
            return setTimeout(() => {
              prepare.click();
              setTimeout(inspect, 50);
            }, 40);
          }
        }
        const approval = entry.querySelector(".explicit-row-approval-card");
        if (prepared && !approved && approval?.textContent?.includes("1 行 · 1 列 · 1 单元格") && approval.textContent.includes("一次性批准")) {
          const button = Array.from(approval.querySelectorAll("button")).find((item) => item.textContent?.includes("批准这一次精确披露"));
          if (button instanceof HTMLButtonElement) { approved = true; button.click(); return setTimeout(inspect, 50); }
        }
        const result = entry.querySelector(".explicit-row-result");
        if (approved && result?.textContent?.includes("已仅根据明确选择的单元格生成解释") && result.textContent.includes("第 1 行")) {
          return resolve({ ok: true, stage: "completed" });
        }
        if (Date.now() >= deadline) return resolve({ ok: false, stage: approved ? "result" : prepared ? "approval" : "selection", text: entry.textContent });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!explicitRows.ok) throw new Error(`Packaged explicit-row disclosure failed at ${explicitRows.stage}: ${explicitRows.text ?? ""}`);
  console.log("BUBU_PACKAGED_EXPLICIT_ROWS_OK");
  const reusableAgentDefinition = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const followup = Array.from(document.querySelectorAll(".result-followups > details")).find((details) => details.textContent?.includes("让受限 Agent 深挖"));
      if (!(followup instanceof HTMLDetailsElement)) return resolve({ ok: false, stage: "entry" });
      followup.open = true;
      const deadline = Date.now() + 8000;
      let saved = false;
      let updated = false;
      const setInput = (input, value) => {
        const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const inspect = () => {
        const panel = followup.querySelector(".aggregate-agent-panel");
        const goal = panel?.querySelector(".agent-goal-form textarea");
        const fields = Array.from(panel?.querySelectorAll(".agent-definition-fields input") ?? []);
        const save = Array.from(panel?.querySelectorAll(".agent-definition-actions button") ?? []).find((button) => button.textContent?.includes(saved ? "更新定义" : "保存当前目标"));
        if (!saved && goal instanceof HTMLTextAreaElement && fields[0] instanceof HTMLInputElement && fields[1] instanceof HTMLInputElement && save instanceof HTMLButtonElement) {
          setInput(goal, "检查区域销售额与订单量是否出现异常背离");
          setInput(fields[0], "Smoke 区域复核 Agent");
          setInput(fields[1], "用于每周区域聚合结果复核");
          saved = true;
          return setTimeout(() => { save.click(); setTimeout(inspect, 80); }, 40);
        }
        const select = panel?.querySelector(".agent-definition-library select");
        const notice = panel?.querySelector(".notice")?.textContent ?? "";
        const selected = select instanceof HTMLSelectElement && Array.from(select.options).some((option) => option.textContent?.includes("Smoke 区域复核 Agent")) && Boolean(select.value);
        if (saved && !updated && selected && notice.includes("已保存在本机") && fields[1] instanceof HTMLInputElement && save instanceof HTMLButtonElement) {
          setInput(fields[1], "更新后的每周区域聚合结果复核说明");
          updated = true;
          return setTimeout(() => { save.click(); setTimeout(inspect, 80); }, 40);
        }
        const remove = Array.from(panel?.querySelectorAll(".agent-definition-actions button") ?? []).find((button) => button.textContent?.includes("删除定义"));
        if (updated && selected && notice.includes("已保存在本机") && remove instanceof HTMLButtonElement) {
          remove.click();
          return setTimeout(() => {
            const finalSelect = panel?.querySelector(".agent-definition-library select");
            const removed = finalSelect instanceof HTMLSelectElement && !Array.from(finalSelect.options).some((option) => option.textContent?.includes("Smoke 区域复核 Agent"));
            resolve({ ok: removed && (panel?.textContent ?? "").includes("历史运行证据保持不变"), stage: removed ? "completed" : "delete" });
          }, 120);
        }
        if (Date.now() >= deadline) return resolve({ ok: false, stage: updated ? "update" : saved ? "save" : "form", text: panel?.textContent });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!reusableAgentDefinition.ok) throw new Error(`Packaged reusable Agent definition failed at ${reusableAgentDefinition.stage}: ${reusableAgentDefinition.text ?? ""}`);
  console.log("BUBU_PACKAGED_AGENT_DEFINITION_OK");
  const compactDrawerResult = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const workbench = document.querySelector(".conversation-workbench");
      const buttons = Array.from(document.querySelectorAll(".workbench-compact-nav button"));
      const taskButton = buttons.find((button) => button.textContent?.includes("历史"));
      const resultButton = buttons.find((button) => button.textContent?.includes("结果"));
      const workflowButton = buttons.find((button) => button.textContent?.includes("工作流"));
      if (!(workbench instanceof HTMLElement) || !(taskButton instanceof HTMLButtonElement) || !(resultButton instanceof HTMLButtonElement) || !(workflowButton instanceof HTMLButtonElement)) {
        return resolve({ ok: false, missing: ["紧凑历史/结果/工作流导航"] });
      }
      taskButton.click();
      await new Promise((next) => setTimeout(next, 50));
      const taskOpened = workbench.classList.contains("compact-threads-open") && taskButton.getAttribute("aria-expanded") === "true";
      taskButton.click();
      resultButton.click();
      await new Promise((next) => setTimeout(next, 50));
      const resultOpened = workbench.classList.contains("compact-artifacts-open") && resultButton.getAttribute("aria-expanded") === "true";
      const reportComposer = document.querySelector(".report-composer");
      const reportAvailable = reportComposer?.querySelector("summary")?.textContent?.includes("组合专业报告")
        && Array.from(reportComposer.querySelectorAll("button")).some((button) => button.textContent?.includes("生成专业报告包"));
      if (reportComposer instanceof HTMLDetailsElement) reportComposer.open = true;
      const reportTitle = reportComposer?.querySelector('input[type="text"], input:not([type])');
      const reportSummary = reportComposer?.querySelector("textarea");
      const reportOptions = Array.from(reportComposer?.querySelectorAll('fieldset input[type="checkbox"]') ?? []);
      const setText = (input, value) => {
        const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      if (reportTitle instanceof HTMLInputElement) setText(reportTitle, "Smoke 自定义专业报告");
      if (reportSummary instanceof HTMLTextAreaElement) setText(reportSummary, "只保留本轮选择的确定性报告组成。");
      reportOptions[1]?.click();
      reportOptions[2]?.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const reportConfigured = reportTitle instanceof HTMLInputElement && reportTitle.value === "Smoke 自定义专业报告"
        && reportSummary instanceof HTMLTextAreaElement && reportSummary.value.includes("确定性报告组成")
        && reportOptions.length === 4 && reportOptions[0]?.checked === true && reportOptions[1]?.checked === false
        && reportOptions[2]?.checked === false && reportOptions[3]?.checked === true;
      const dataTab = Array.from(document.querySelectorAll('[role="tab"]')).find((button) => button.textContent?.includes("数据"));
      if (dataTab instanceof HTMLButtonElement) dataTab.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const actionButtons = Array.from(document.querySelectorAll(".artifact-data-toolbar button"));
      const copyAvailable = actionButtons.some((button) => button.textContent?.includes("复制"));
      const exportAvailable = actionButtons.some((button) => button.textContent?.includes("导出当前视图"));
      const pinButton = actionButtons.find((button) => button.textContent?.includes("固定"));
      if (pinButton instanceof HTMLButtonElement) pinButton.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const pinToggled = pinButton?.getAttribute("aria-pressed") === "true";
      if (pinButton instanceof HTMLButtonElement) pinButton.click();
      dataTab?.focus();
      dataTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const visualTab = Array.from(document.querySelectorAll('[role="tab"]')).find((button) => button.textContent?.includes("可视化"));
      const arrowNavigation = visualTab?.getAttribute("aria-selected") === "true";
      const metricTabs = Array.from(document.querySelectorAll('.visualization-switcher [role="tab"]'));
      const secondMetric = metricTabs[1];
      if (secondMetric instanceof HTMLButtonElement) secondMetric.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const selectedMetric = secondMetric?.textContent ?? "";
      const metricSelected = secondMetric?.getAttribute("aria-selected") === "true";
      if (dataTab instanceof HTMLButtonElement) dataTab.click();
      if (visualTab instanceof HTMLButtonElement) visualTab.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const restoredMetric = Array.from(document.querySelectorAll('.visualization-switcher [role="tab"]')).find((button) => button.getAttribute("aria-selected") === "true")?.textContent ?? "";
      const visualizationPreferenceRestored = metricTabs.length >= 2 && metricSelected && restoredMetric === selectedMetric;
      resultButton.click();
      workflowButton.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const workflowOpened = workbench.classList.contains("compact-workflow-open") && workflowButton.getAttribute("aria-expanded") === "true" && Boolean(document.querySelector(".workflow-panel"));
      workbench.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const closed = !workbench.classList.contains("compact-threads-open") && !workbench.classList.contains("compact-artifacts-open") && !workbench.classList.contains("compact-workflow-open");
      resolve({ ok: taskOpened && resultOpened && reportAvailable && reportConfigured && copyAvailable && exportAvailable && pinToggled && arrowNavigation && visualizationPreferenceRestored && workflowOpened && closed, missing: [
        ...(!taskOpened ? ["任务抽屉状态"] : []),
        ...(!resultOpened ? ["结果抽屉状态"] : []),
        ...(!reportAvailable ? ["专业报告组合与导出"] : []),
        ...(!reportConfigured ? ["专业报告自定义组成"] : []),
        ...(!copyAvailable ? ["复制当前结果"] : []),
        ...(!exportAvailable ? ["导出当前结果"] : []),
        ...(!pinToggled ? ["固定结果状态"] : []),
        ...(!arrowNavigation ? ["结果页签方向键"] : []),
        ...(!visualizationPreferenceRestored ? ["多指标切换与偏好恢复"] : []),
        ...(!workflowOpened ? ["工作流抽屉状态"] : []),
        ...(!closed ? ["抽屉关闭状态"] : []),
      ] });
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!compactDrawerResult.ok) {
    throw new Error(`Packaged renderer compact drawers failed: ${compactDrawerResult.missing.join(", ")}`);
  }
  console.log("BUBU_PACKAGED_REPORT_COMPOSITION_OK");
  console.log("BUBU_PACKAGED_VISUALIZATION_PREFERENCE_OK");
  const conversationMenu = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const workbench = document.querySelector(".conversation-workbench");
      if (!(workbench instanceof HTMLElement)) return resolve({ ok: false });
      workbench.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 620, clientY: 220 }));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const menu = document.querySelector('.context-menu[aria-label="对话操作"]');
      const opened = menu?.textContent?.includes("查看任务历史") && menu.textContent.includes("查看工作流");
      menu?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      resolve({ ok: Boolean(opened) && document.querySelector('.context-menu[aria-label="对话操作"]') === null });
    })
  `) as { readonly ok: boolean };
  if (!conversationMenu.ok) throw new Error("Packaged renderer conversation context menu failed");
  const taskState = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const plan = document.querySelector(".plan-card");
      const textarea = document.querySelector(".analysis-composer textarea");
      if (!(plan instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) return resolve({ ok: false });
      textarea.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 700, clientY: 560 }));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      resolve({ ok: plan.innerText.includes("本次执行计划") && plan.innerText.includes("已本地执行") && !plan.innerText.includes("需要你的批准") && document.querySelector('.context-menu[aria-label="对话操作"]') === null });
    })
  `) as { readonly ok: boolean };
  if (!taskState.ok) throw new Error("Packaged renderer task state or native composer context menu failed");
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const composer = document.querySelector(".analysis-composer");
      const conversation = document.querySelector(".conversation-stage");
      window.scrollTo({ top: 0 });
      if (composer instanceof HTMLElement && conversation instanceof HTMLElement) {
        conversation.scrollTop = composer.offsetTop - (conversation.clientHeight - composer.clientHeight) / 2;
      }
      setTimeout(resolve, 220);
    })
  `);
  await captureSmokeStep(window, screenshotDirectory, "02-chat.png");
  const artifactLayout = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const workbench = document.querySelector(".conversation-workbench");
      const resultButton = Array.from(document.querySelectorAll(".workbench-compact-nav button")).find((button) => button.textContent?.includes("结果"));
      if (!(workbench instanceof HTMLElement) || !(resultButton instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["结果抽屉按钮"] });
      resultButton.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const inspector = workbench.querySelector(".artifact-inspector");
      const visualTab = Array.from(inspector?.querySelectorAll('[role="tab"]') ?? []).find((button) => button.textContent?.includes("可视化"));
      if (visualTab instanceof HTMLButtonElement) visualTab.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const chart = inspector?.querySelector(".result-visualization");
      if (!(inspector instanceof HTMLElement) || !(chart instanceof HTMLElement)) return resolve({ ok: false, missing: ["结果抽屉或可视化"] });
      await Promise.all(inspector.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const measurements = {
        workbenchWidth: workbench.clientWidth,
        inspectorOffset: inspector.offsetLeft,
        inspectorWidth: inspector.offsetWidth,
        inspectorClientWidth: inspector.clientWidth,
        inspectorScrollWidth: inspector.scrollWidth,
        chartClientWidth: chart.clientWidth,
        chartScrollWidth: chart.scrollWidth,
      };
      const contained = measurements.inspectorOffset >= -1
        && measurements.inspectorOffset + measurements.inspectorWidth <= measurements.workbenchWidth + 1
        && measurements.inspectorScrollWidth - measurements.inspectorClientWidth <= 1
        && measurements.chartScrollWidth - measurements.chartClientWidth <= 1;
      resolve({ ok: contained, missing: contained ? [] : ["结果抽屉或图表超出工作台"], measurements });
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly measurements?: Readonly<Record<string, unknown>> };
  if (!artifactLayout.ok) throw new Error(`Packaged renderer Artifact layout failed: ${artifactLayout.missing.join(", ")} ${JSON.stringify(artifactLayout.measurements ?? {})}`);
  await captureSmokeStep(window, screenshotDirectory, "04-artifact.png");
  const derivedAction = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const inspector = document.querySelector(".artifact-inspector");
      const summaryTab = Array.from(inspector?.querySelectorAll('[role="tab"]') ?? []).find((button) => button.textContent?.includes("摘要"));
      if (!(inspector instanceof HTMLElement) || !(summaryTab instanceof HTMLButtonElement)) return resolve({ ok: false });
      summaryTab.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const materialize = inspector.querySelector(".derived-materialize");
      if (materialize instanceof HTMLDetailsElement) materialize.open = true;
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const input = materialize?.querySelector("input");
      const save = Array.from(materialize?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("保存当前计划结果"));
      const bounds = materialize?.getBoundingClientRect();
      const inspectorBounds = inspector.getBoundingClientRect();
      const contained = bounds && bounds.left >= inspectorBounds.left - 1 && bounds.right <= inspectorBounds.right + 1;
      resolve({ ok: materialize instanceof HTMLDetailsElement && input instanceof HTMLInputElement && save instanceof HTMLButtonElement && contained && materialize.innerText.includes("不可变版本") && materialize.innerText.includes("上游版本") });
    })
  `) as { readonly ok: boolean };
  if (!derivedAction.ok) throw new Error("Packaged renderer derived-object materialization action failed");
  await captureSmokeStep(window, screenshotDirectory, "06-derived-object.png");
  const derivedRoundTrip = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const materialize = document.querySelector(".derived-materialize");
      const input = materialize?.querySelector("input");
      const save = Array.from(materialize?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("保存当前计划结果"));
      if (!(input instanceof HTMLInputElement) || !(save instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["派生对象表单"] });
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "smoke-derived-summary");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const clickWhenReady = () => {
        if (!save.disabled) return save.click();
        setTimeout(clickWhenReady, 20);
      };
      clickWhenReady();
      const deadline = Date.now() + 8000;
      let recomputeStarted = false;
      const inspect = () => {
        const activeTitle = document.querySelector(".workspace-identity h2")?.textContent ?? "";
        const derivedCard = Array.from(document.querySelectorAll(".contact-card")).find((card) => card.textContent?.includes("smoke-derived-summary"));
        if (activeTitle.includes("smoke-derived-summary") && derivedCard?.textContent?.includes("派生")) {
          const resultButton = Array.from(document.querySelectorAll(".workbench-compact-nav button")).find((button) => button.textContent?.includes("结果"));
          if (!(resultButton instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["派生对象结果按钮"] });
          resultButton.click();
          const lineageDeadline = Date.now() + 8000;
          const inspectLineage = () => {
            const fallback = document.querySelector(".artifact-context-fallback");
            if (fallback instanceof HTMLDetailsElement && !fallback.open) {
              fallback.open = true;
              return setTimeout(inspectLineage, 80);
            }
            const lineage = document.querySelector(".lineage-panel");
            if (lineage?.textContent?.includes("smoke-derived-summary") && lineage.textContent.includes("用当前上游版本重算")) {
              lineage.scrollIntoView({ block: "start", inline: "nearest" });
              const recompute = Array.from(lineage.querySelectorAll("button")).find((button) => button.textContent?.includes("用当前上游版本重算"));
              if (!recomputeStarted && recompute instanceof HTMLButtonElement) {
                recomputeStarted = true;
                recompute.click();
                return setTimeout(inspectLineage, 40);
              }
              const versionSummary = document.querySelector(".versions-menu summary")?.textContent ?? "";
              const derivedCard = Array.from(document.querySelectorAll(".contact-card")).find((card) => card.textContent?.includes("smoke-derived-summary"));
              if (recomputeStarted && lineage.textContent.includes("版本 2") && versionSummary.includes("版本 2") && derivedCard?.textContent?.includes("版本 2")) {
                return requestAnimationFrame(() => requestAnimationFrame(() => resolve({ ok: true, missing: [] })));
              }
            }
            if (Date.now() >= lineageDeadline) return resolve({ ok: false, missing: ["派生关系检查器"] });
            setTimeout(inspectLineage, 40);
          };
          return inspectLineage();
        }
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["派生对象目录回跳"] });
        setTimeout(inspect, 40);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!derivedRoundTrip.ok) throw new Error(`Packaged renderer derived-object round trip failed: ${derivedRoundTrip.missing.join(", ")}`);
  await captureSmokeStep(window, screenshotDirectory, "07-lineage.png");
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const closeButton = document.querySelector(".workbench-close-pane");
      if (closeButton instanceof HTMLButtonElement) closeButton.click();
      const original = Array.from(document.querySelectorAll(".contact-card")).find((card) => card.textContent?.includes("synthetic-sales"));
      if (original instanceof HTMLButtonElement) original.click();
      setTimeout(resolve, 260);
    })
  `);
  const workflowGraph = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const workflowButton = Array.from(document.querySelectorAll(".workbench-compact-nav button")).find((button) => button.textContent?.includes("工作流"));
      if (!(workflowButton instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["工作流按钮"] });
      workflowButton.click();
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const graph = document.querySelector(".workflow-graph");
        const contents = graph?.textContent ?? "";
        const panel = document.querySelector(".workflow-panel");
        const inspector = document.querySelector(".artifact-inspector");
        const workbench = document.querySelector(".conversation-workbench");
        const layout = document.querySelector(".conversation-workbench-layout");
        const conversation = document.querySelector(".conversation");
        const panelBounds = panel?.getBoundingClientRect();
        const inspectorBounds = inspector?.getBoundingClientRect();
        const workbenchBounds = workbench?.getBoundingClientRect();
        const layoutBounds = layout?.getBoundingClientRect();
        const headingBounds = panel?.querySelector(".workflow-header")?.getBoundingClientRect();
        const headingCopyBounds = panel?.querySelector(".workflow-header > div:first-child")?.getBoundingClientRect();
        const scheduleCopyBounds = panel?.querySelector(".settings-copy")?.getBoundingClientRect();
        const graphBounds = graph?.getBoundingClientRect();
        const graphCopyBounds = graph?.querySelector("header > div:first-child")?.getBoundingClientRect();
        const firstNodeIconBounds = graph?.querySelector(".workflow-node-icon")?.getBoundingClientRect();
        const panelStyle = panel instanceof HTMLElement ? getComputedStyle(panel) : undefined;
        const panelContentLeft = panelBounds && panelStyle ? panelBounds.left + Number.parseFloat(panelStyle.paddingLeft) : undefined;
        const contained = panel instanceof HTMLElement && inspector instanceof HTMLElement && workbench instanceof HTMLElement && layout instanceof HTMLElement && panelBounds && inspectorBounds && workbenchBounds && layoutBounds
          && panel.scrollWidth - panel.clientWidth <= 1
          && panel.scrollLeft === 0
          && workbench.scrollLeft === 0
          && layout.scrollLeft === 0
          && inspector.scrollWidth - inspector.clientWidth <= 1
          && inspector.scrollLeft === 0
          && panelBounds.left >= inspectorBounds.left - 1
          && panelBounds.right <= inspectorBounds.right + 1
          && headingBounds && headingBounds.left >= inspectorBounds.left - 1 && headingBounds.right <= inspectorBounds.right + 1
          && graphBounds && graphBounds.left >= inspectorBounds.left - 1 && graphBounds.right <= inspectorBounds.right + 1
          && panelContentLeft !== undefined
          && headingCopyBounds && headingCopyBounds.left >= panelContentLeft - 1
          && scheduleCopyBounds && scheduleCopyBounds.left >= panelContentLeft - 1
          && graphCopyBounds && graphCopyBounds.left >= graphBounds.left + 13
          && firstNodeIconBounds && firstNodeIconBounds.left >= graphBounds.left + 13
          && inspectorBounds.left >= workbenchBounds.left - 1
          && inspectorBounds.right <= workbenchBounds.right + 1
          && layoutBounds.left >= workbenchBounds.left - 1
          && layoutBounds.right <= workbenchBounds.right + 1;
        const saveButton = Array.from(panel?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("保存为工作流"));
        const saveBounds = saveButton?.getBoundingClientRect();
        const saveVisible = saveButton instanceof HTMLButtonElement && saveBounds && inspectorBounds && saveBounds.left >= inspectorBounds.left - 1 && saveBounds.right <= inspectorBounds.right + 1;
        const ok = graph instanceof HTMLElement && contained && saveVisible && panel?.innerText.includes("仅在你点击运行时执行，不会自动触发。") && contents.includes("每周区域销售汇总") && contents.includes("发送结果到当前对话") && graph.querySelectorAll(".workflow-node").length >= 4;
        const measurements = panelBounds && inspectorBounds && workbenchBounds ? { panelLeft: panelBounds.left, panelRight: panelBounds.right, panelContentLeft, panelClientWidth: panel.clientWidth, panelScrollWidth: panel.scrollWidth, panelScrollLeft: panel.scrollLeft, headingCopyLeft: headingCopyBounds?.left, scheduleCopyLeft: scheduleCopyBounds?.left, graphLeft: graphBounds?.left, graphCopyLeft: graphCopyBounds?.left, firstNodeIconLeft: firstNodeIconBounds?.left, inspectorLeft: inspectorBounds.left, inspectorRight: inspectorBounds.right, inspectorClientWidth: inspector.clientWidth, inspectorScrollWidth: inspector.scrollWidth, inspectorScrollLeft: inspector.scrollLeft, inspectorOffsetParent: inspector.offsetParent?.className, inspectorTransform: getComputedStyle(inspector).transform, workbenchLeft: workbenchBounds.left, workbenchRight: workbenchBounds.right, workbenchScrollLeft: workbench.scrollLeft, layoutLeft: layoutBounds?.left, layoutRight: layoutBounds?.right, layoutScrollLeft: layout instanceof HTMLElement ? layout.scrollLeft : undefined, conversationScrollLeft: conversation instanceof HTMLElement ? conversation.scrollLeft : undefined } : {};
        if (ok) return resolve({ ok: true, missing: [], measurements });
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["动态工作流节点图"], measurements });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly measurements?: Readonly<Record<string, number>> };
  if (!workflowGraph.ok) throw new Error(`Packaged renderer Workflow graph failed: ${workflowGraph.missing.join(", ")} ${JSON.stringify(workflowGraph.measurements ?? {})}`);
  console.log("BUBU_PACKAGED_WORKFLOW_GEOMETRY", JSON.stringify(workflowGraph.measurements ?? {}));
  const workflowApproval = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const panel = document.querySelector(".workflow-panel");
      const toggle = panel?.querySelector('.workflow-approval-toggle input[type="checkbox"]');
      const save = Array.from(panel?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("保存为工作流"));
      if (!(toggle instanceof HTMLInputElement) || !(save instanceof HTMLButtonElement)) return resolve({ ok: false, stage: "controls" });
      toggle.click();
      save.click();
      const deadline = Date.now() + 12000;
      let runStarted = false;
      let approved = false;
      const inspect = () => {
        const reviewed = Array.from(panel?.querySelectorAll(".workflow-row") ?? []).find((row) => row.textContent?.includes("Smoke sum by region") && row.textContent.includes("2 步"));
        if (!runStarted && reviewed instanceof HTMLElement) {
          const run = Array.from(reviewed.querySelectorAll("button")).find((button) => button.textContent?.trim() === "运行");
          if (run instanceof HTMLButtonElement) { runStarted = true; run.click(); return setTimeout(inspect, 80); }
        }
        const approval = panel?.querySelector(".workflow-approval-card");
        if (runStarted && !approved && approval?.textContent?.includes("等待人工批准") && approval.textContent.includes("继续把本次受审结果交付到所属任务")) {
          const button = Array.from(approval.querySelectorAll("button")).find((item) => item.textContent?.includes("批准并恢复同一运行"));
          if (button instanceof HTMLButtonElement) { approved = true; button.click(); return setTimeout(inspect, 80); }
        }
        const runEvidence = panel?.querySelector(".workflow-run")?.textContent ?? "";
        if (approved && runEvidence.includes("最近运行 · 已完成") && runEvidence.includes("human-checkpoint") && !panel?.querySelector(".workflow-approval-card")) {
          return resolve({ ok: true, stage: "completed" });
        }
        if (Date.now() >= deadline) return resolve({ ok: false, stage: approved ? "resume" : runStarted ? "approval" : "save", text: panel?.textContent });
        setTimeout(inspect, 60);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage: string; readonly text?: string };
  if (!workflowApproval.ok) throw new Error(`Packaged workflow approval failed at ${workflowApproval.stage}: ${workflowApproval.text ?? ""}`);
  console.log("BUBU_PACKAGED_WORKFLOW_APPROVAL_OK");
  const externalDelivery = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const panel = document.querySelector(".external-delivery-panel");
      const fields = panel?.querySelectorAll("input");
      const save = Array.from(panel?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("只保存，不发送"));
      if (!(panel instanceof HTMLElement) || !fields || fields.length < 3 || !(save instanceof HTMLButtonElement)) return resolve({ ok: false, stage: "controls" });
      const values = ["Smoke webhook", "https://hooks.example.com/bubu", "synthetic-signing-secret"];
      fields.forEach((field, index) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set; setter?.call(field, values[index]); field.dispatchEvent(new Event("input", { bubbles: true })); });
      save.click();
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const card = panel.querySelector(".mcp-connection-card");
        const bind = Array.from(card?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("绑定当前"));
        if (bind instanceof HTMLButtonElement) {
          bind.click();
          return setTimeout(() => resolve({ ok: panel.textContent?.includes("已绑定 v") && panel.textContent.includes("renderer 不可读取") && panel.textContent.includes("不发送原始行") }), 120);
        }
        if (Date.now() >= deadline) return resolve({ ok: false, stage: "save", text: panel.textContent });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly stage?: string; readonly text?: string };
  if (!externalDelivery.ok) throw new Error(`Packaged external delivery profile failed at ${externalDelivery.stage ?? "bind"}: ${externalDelivery.text ?? ""}`);
  console.log("BUBU_PACKAGED_EXTERNAL_DELIVERY_OK");
  await captureSmokeStep(window, screenshotDirectory, "05-workflow.png");
  await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const closeButton = document.querySelector(".workbench-close-pane");
      if (closeButton instanceof HTMLButtonElement) closeButton.click();
      setTimeout(resolve, 220);
    })
  `);
  const cleanTemplates = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const open = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("清理数据"));
      if (!(open instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["Data Clean 入口"] });
      open.click();
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const catalog = document.querySelector(".data-clean-templates");
        const reference = Array.from(catalog?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("参考数据映射检查"));
        const text = catalog?.textContent ?? "";
        const namesReady = ["月度汇总准备", "客户主键去重", "订单字段整理", "追加周期导出", "参考数据映射检查"].every((name) => text.includes(name));
        if (namesReady && reference instanceof HTMLButtonElement) {
          reference.click();
          return setTimeout(() => {
            const dialog = document.querySelector(".data-clean-dialog");
            const ready = dialog?.textContent?.includes("第二数据来源") && dialog.textContent.includes("参考对象只在本地用于覆盖率检查");
            resolve({ ok: Boolean(ready), missing: ready ? [] : ["多来源模板控件"] });
          }, 80);
        }
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["五个 Clean 模板"] });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!cleanTemplates.ok) throw new Error(`Packaged Clean template catalog failed: ${cleanTemplates.missing.join(", ")}`);
  await captureSmokeStep(window, screenshotDirectory, "10-data-clean-templates.png");
  await window.webContents.executeJavaScript(`document.querySelector('button[aria-label="关闭 Data Clean"]')?.click()`);
  const dataCleanReview = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const open = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("清理数据"));
      if (!(open instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["Data Clean 入口"] });
      open.click();
      const deadline = Date.now() + 8000;
      let cancelledOnce = false;
      let submitted = false;
      let qualitySelected = false;
      const inspect = () => {
        const dialog = document.querySelector(".data-clean-dialog");
        if (!cancelledOnce && dialog instanceof HTMLElement) {
          const close = dialog.querySelector('button[aria-label="关闭 Data Clean"]');
          if (close instanceof HTMLButtonElement) {
            cancelledOnce = true;
            close.click();
            return setTimeout(() => { open.click(); inspect(); }, 40);
          }
        }
        if (!submitted && dialog instanceof HTMLElement) {
          const name = dialog.querySelector("input:not([type=checkbox])");
          const qualityColumn = dialog.querySelector(".data-clean-quality-controls select");
          const accepted = Array.from(dialog.querySelectorAll(".data-clean-quality-controls input")).find((input) => input.type === "text");
          const preview = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("预览影响"));
          if (name instanceof HTMLInputElement && qualityColumn instanceof HTMLSelectElement && preview instanceof HTMLButtonElement) {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(name, "smoke-data-clean");
            name.dispatchEvent(new Event("input", { bubbles: true }));
            const firstColumn = qualityColumn.options.item(1)?.value;
            if (firstColumn && !qualitySelected) {
              qualitySelected = true;
              Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(qualityColumn, firstColumn);
              qualityColumn.dispatchEvent(new Event("change", { bubbles: true }));
              return setTimeout(inspect, 40);
            }
            if (accepted instanceof HTMLInputElement) {
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(accepted, "__never_matches__");
              accepted.dispatchEvent(new Event("input", { bubbles: true }));
              submitted = true;
              return setTimeout(() => { preview.click(); inspect(); }, 40);
            }
          }
        }
        const review = document.querySelector(".data-clean-review");
        const contents = review?.textContent ?? "";
        const blockedButton = Array.from(review?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("先修复阻断项"));
        const ok = cancelledOnce && contents.includes("执行前审查") && contents.includes("smoke-data-clean") && contents.includes("计划指纹") && contents.includes("选择并重排列") && contents.includes("只能使用一次") && contents.includes("质量门禁未通过") && blockedButton instanceof HTMLButtonElement && blockedButton.disabled;
        if (ok) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["Data Clean 影响审查"] });
        setTimeout(inspect, 40);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!dataCleanReview.ok) throw new Error(`Packaged renderer Data Clean review failed: ${dataCleanReview.missing.join(", ")}`);
  await captureSmokeStep(window, screenshotDirectory, "10-data-clean-review.png");
  const dataCleanResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 12000;
      let measurements = {};
      let phase = "blocked-review";
      const inspect = () => {
        if (phase === "blocked-review") {
          const back = Array.from(document.querySelectorAll(".data-clean-review button")).find((button) => button.textContent?.includes("返回修改"));
          if (back instanceof HTMLButtonElement) { phase = "passing-builder"; back.click(); return setTimeout(inspect, 40); }
        }
        const builder = document.querySelector(".data-clean-builder");
        if (phase === "passing-builder" && builder instanceof HTMLElement) {
          const qualityColumn = builder.querySelector(".data-clean-quality-controls select");
          const accepted = Array.from(builder.querySelectorAll(".data-clean-quality-controls input")).find((input) => input.type === "text");
          const preview = Array.from(builder.querySelectorAll("button")).find((button) => button.textContent?.includes("预览影响"));
          if (qualityColumn instanceof HTMLSelectElement && accepted instanceof HTMLInputElement && preview instanceof HTMLButtonElement) {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(accepted, "001,002,003");
            accepted.dispatchEvent(new Event("input", { bubbles: true }));
            phase = "passing-review";
            return setTimeout(() => { preview.click(); inspect(); }, 40);
          }
        }
        const approve = Array.from(document.querySelectorAll(".data-clean-review button")).find((button) => button.textContent?.includes("批准并创建数据对象"));
        if (phase === "passing-review" && approve instanceof HTMLButtonElement && !approve.disabled) { approve.click(); phase = "executing"; return setTimeout(inspect, 40); }
        const activeTitle = document.querySelector(".workspace-identity h2")?.textContent ?? "";
        const card = Array.from(document.querySelectorAll(".contact-card")).find((value) => value.textContent?.includes("smoke-data-clean"));
        if (activeTitle.includes("smoke-data-clean") && card?.textContent?.includes("派生")) {
          const resultButton = Array.from(document.querySelectorAll(".workbench-compact-nav button")).find((button) => button.textContent?.includes("结果"));
          if (resultButton instanceof HTMLButtonElement && resultButton.getAttribute("aria-expanded") !== "true") resultButton.click();
          const fallback = document.querySelector(".artifact-context-fallback");
          if (fallback instanceof HTMLDetailsElement && !fallback.open) fallback.open = true;
          const evidence = document.querySelector(".lineage-execution-evidence");
          const contents = evidence?.textContent ?? "";
          const inspector = document.querySelector(".artifact-inspector");
          const evidenceBounds = evidence?.getBoundingClientRect();
          const inspectorBounds = inspector?.getBoundingClientRect();
          const contained = evidence instanceof HTMLElement && inspector instanceof HTMLElement && evidenceBounds && inspectorBounds && evidence.scrollWidth - evidence.clientWidth <= 1 && evidenceBounds.left >= inspectorBounds.left - 1 && evidenceBounds.right <= inspectorBounds.right + 1;
          measurements = evidenceBounds && inspectorBounds && evidence instanceof HTMLElement && inspector instanceof HTMLElement ? { evidenceLeft: evidenceBounds.left, evidenceRight: evidenceBounds.right, evidenceClientWidth: evidence.clientWidth, evidenceScrollWidth: evidence.scrollWidth, inspectorLeft: inspectorBounds.left, inspectorRight: inspectorBounds.right, inspectorClientWidth: inspector.clientWidth, inspectorScrollWidth: inspector.scrollWidth } : {};
          if (contained && contents.includes("版本执行证据") && contents.includes("一次性审查批准") && contents.includes("执行标识") && contents.includes("质量门禁通过") && contents.includes("完成质量证明")) {
            evidence?.scrollIntoView({ block: "center", inline: "nearest" });
            const animations = inspector instanceof HTMLElement ? inspector.getAnimations() : [];
            return Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
              evidence?.scrollIntoView({ block: "center", inline: "nearest" });
              setTimeout(() => resolve({ ok: true, missing: [] }), 120);
            });
          }
        }
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["Data Clean 派生对象"], measurements });
        setTimeout(inspect, 40);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly measurements?: Readonly<Record<string, number>> };
  if (!dataCleanResult.ok) throw new Error(`Packaged renderer Data Clean execution failed: ${dataCleanResult.missing.join(", ")} ${JSON.stringify(dataCleanResult.measurements ?? {})}`);
  await captureSmokeStep(window, screenshotDirectory, "11-data-clean-result.png");
  const recurringDatasets = await smokeSidecars.listDatasets();
  const recurringSource = recurringDatasets.find(({ displayName }) => displayName === "synthetic-sales");
  const recurringClean = recurringDatasets.find(({ displayName }) => displayName === "smoke-data-clean");
  if (!recurringSource || !recurringClean) throw new Error("Packaged recurring proof is missing its source or Clean object");
  await smokeSidecars.replaceDataset(recurringSource.id, driftSourcePath);
  const blockedRecomputes = await smokeSidecars.processDerivedRecomputeEvents();
  const blocked = blockedRecomputes.find(({ targetDatasetId }) => targetDatasetId === recurringClean.id);
  if (blocked?.status !== "paused" || blocked.reasonKind !== "quality-block") {
    throw new Error(`Packaged recurring quality pause failed: ${JSON.stringify(blockedRecomputes)}`);
  }
  const blockedUi = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 7000;
      const inspect = () => {
        const panel = document.querySelector(".derived-automation");
        const text = panel?.textContent ?? "";
        if (text.includes("需要处理") && text.includes("质量门禁阻断") && text.includes("重试")) {
          panel?.scrollIntoView({ block: "center" });
          return setTimeout(() => resolve({ ok: true }), 100);
        }
        if (Date.now() >= deadline) return resolve({ ok: false, text });
        setTimeout(inspect, 100);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly text?: string };
  if (!blockedUi.ok) throw new Error(`Packaged recurring pause UI failed: ${blockedUi.text ?? "missing"}`);
  await captureSmokeStep(window, screenshotDirectory, "12-recurring-quality-pause.png");
  await smokeSidecars.replaceDataset(recurringSource.id, sourcePath);
  const recoveredRecomputes = await smokeSidecars.processDerivedRecomputeEvents();
  const recovered = recoveredRecomputes.find(({ targetDatasetId, status }) => targetDatasetId === recurringClean.id && status === "succeeded");
  if (!recovered) throw new Error(`Packaged recurring remediation failed: ${JSON.stringify(recoveredRecomputes)}`);
  const remediated = (await smokeSidecars.listDatasets()).find(({ id }) => id === recurringClean.id);
  if (remediated?.version !== 2) throw new Error(`Packaged recurring output did not advance exactly once: ${JSON.stringify(remediated)}`);
  await window.reload();
  const recoveredUi = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 8000;
      let selected = false;
      const inspect = () => {
        if (!selected) {
          const card = Array.from(document.querySelectorAll(".contact-card")).find((item) => item.textContent?.includes("smoke-data-clean"));
          if (card instanceof HTMLButtonElement) { selected = true; card.click(); }
        }
        const resultButton = Array.from(document.querySelectorAll(".workbench-compact-nav button")).find((button) => button.textContent?.includes("结果"));
        if (resultButton instanceof HTMLButtonElement && resultButton.getAttribute("aria-expanded") !== "true") resultButton.click();
        const fallback = document.querySelector(".artifact-context-fallback");
        if (fallback instanceof HTMLDetailsElement && !fallback.open) fallback.open = true;
        const panel = document.querySelector(".derived-automation");
        const text = panel?.textContent ?? "";
        const versionSummary = document.querySelector(".versions-menu summary")?.textContent ?? "";
        const card = Array.from(document.querySelectorAll(".contact-card")).find((item) => item.textContent?.includes("smoke-data-clean"));
        if (versionSummary.includes("版本 2") && card?.textContent?.includes("版本 2") && text.includes("已完成") && text.includes("需要处理")) {
          const inspector = document.querySelector(".artifact-inspector");
          const panelBounds = panel?.getBoundingClientRect();
          const inspectorBounds = inspector?.getBoundingClientRect();
          if (inspector instanceof HTMLElement && panelBounds && inspectorBounds) inspector.scrollTop += panelBounds.top - inspectorBounds.top - 90;
          return setTimeout(() => resolve({ ok: true }), 180);
        }
        if (Date.now() >= deadline) return resolve({ ok: false, text, versionSummary, card: card?.textContent });
        setTimeout(inspect, 100);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly text?: string; readonly versionSummary?: string; readonly card?: string };
  if (!recoveredUi.ok) throw new Error(`Packaged recurring remediation UI failed: ${JSON.stringify(recoveredUi)}`);
  await captureSmokeStep(window, screenshotDirectory, "13-recurring-remediated.png");
  console.log("BUBU_PACKAGED_RECURRING_CLEAN_OK");
  const groupResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const groupButton = document.querySelector('button[title="业务主题"]');
      if (!(groupButton instanceof HTMLButtonElement)) {
        return resolve({ ok: false, missing: ["业务主题按钮"] });
      }
      groupButton.click();
      const expected = ["synthetic-group", "2 个数据对象", "每周更新", "先生成关联计划"];
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const contents = document.body.innerText;
        const missing = expected.filter((value) => !contents.includes(value));
        if (missing.length === 0) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!groupResult.ok) {
    throw new Error(`Packaged renderer is missing dataset groups: ${groupResult.missing.join(", ")}`);
  }
  await verifySmokeLayout(window, "group");
  await captureSmokeStep(window, screenshotDirectory, "02-groups.png");
  const emptyGroupResult = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const resultButton = Array.from(document.querySelectorAll(".workbench-compact-nav button")).find((button) => button.textContent?.includes("结果"));
      if (!(resultButton instanceof HTMLButtonElement)) return resolve({ ok: false });
      resultButton.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const empty = document.querySelector(".artifact-empty-state");
      const ok = empty?.textContent?.includes("先开始一个数据任务") && empty.textContent.includes("查看数据结构与健康");
      const close = document.querySelector(".workbench-close-pane");
      if (close instanceof HTMLButtonElement) close.click();
      resolve({ ok: Boolean(ok) });
    })
  `) as { readonly ok: boolean };
  if (!emptyGroupResult.ok) throw new Error("Packaged renderer empty result state failed");
  const settingsResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const settingsButton = document.querySelector('button[title="设置"]');
      if (!(settingsButton instanceof HTMLButtonElement)) {
        return resolve({ ok: false, missing: ["模型设置按钮"] });
      }
      settingsButton.click();
      const expected = ["使用前检查", "重新检查", "模型提供商", "添加模型", "服务地址（Base URL）", "模型名称", "API 密钥", "安全保存配置"];
      const deadline = Date.now() + 5000;
      const inspect = () => {
        const contents = document.body.innerText;
        const missing = expected.filter((value) => !contents.includes(value));
        const currentSection = document.querySelector('.settings-nav button[aria-current="page"]');
        if (missing.length === 0 && currentSection?.textContent?.includes("模型与提供商")) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[] };
  if (!settingsResult.ok) {
    throw new Error(`Packaged renderer is missing provider settings: ${settingsResult.missing.join(", ")}`);
  }
  await verifySmokeLayout(window, "settings");
  await captureSmokeStep(window, screenshotDirectory, "03-settings.png");
  const outputTemplateSettings = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const prompts = Array.from(document.querySelectorAll(".settings-nav button")).find((button) => button.textContent?.includes("分析与输出"));
      if (!(prompts instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["分析与输出设置入口"] });
      prompts.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const restore = Array.from(document.querySelectorAll(".prompt-settings button")).find((button) => button.textContent?.includes("恢复默认"));
      if (!(restore instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["输出模板确定性重置"] });
      restore.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const outputTab = Array.from(document.querySelectorAll('.prompt-scope-tabs [role="tab"]')).find((button) => button.textContent?.includes("输出 · 聚合解读"));
      if (!(outputTab instanceof HTMLButtonElement)) return resolve({ ok: false, missing: ["输出模板类别"] });
      outputTab.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      const form = document.querySelector(".prompt-template-form");
      const fields = form?.querySelectorAll("input, textarea");
      if (!(form instanceof HTMLFormElement) || !fields || fields.length < 3) return resolve({ ok: false, missing: ["自定义输出模板表单"] });
      const values = ["Smoke 输出模板", "打包端到端输出偏好", "先给出一句结论，再引用最少且充分的已批准单元格。"];
      fields.forEach((field, index) => {
        const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, values[index] ?? "");
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      form.requestSubmit();
      const deadline = Date.now() + 8000;
      const inspect = () => {
        const contents = document.querySelector(".prompt-settings")?.textContent ?? "";
        const active = document.querySelector(".prompt-template-card-active")?.textContent ?? "";
        const registry = localStorage.getItem("bubu:prompt-template-registry:v1") ?? "";
        const ok = contents.includes("证据优先") && contents.includes("管理层简报") && contents.includes("Smoke 输出模板") && active.includes("Smoke 输出模板") && registry.includes("Smoke 输出模板");
        if (ok) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["输出模板保存或选择"], details: { contents, active, values: Array.from(form.querySelectorAll("input, textarea")).map((field) => field.value), notice: document.querySelector(".prompt-settings .notice")?.textContent ?? "", selectedTab: document.querySelector('.prompt-scope-tabs [aria-selected="true"]')?.textContent ?? "", registryLength: registry.length } });
        setTimeout(inspect, 40);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly details?: Readonly<Record<string, unknown>> };
  if (!outputTemplateSettings.ok) throw new Error(`Packaged renderer output template flow failed: ${outputTemplateSettings.missing.join(", ")} ${JSON.stringify(outputTemplateSettings.details ?? {})}`);
  await verifySmokeLayout(window, "output templates");
  await captureSmokeStep(window, screenshotDirectory, "08-output-templates.png");
  const settingsNavigation = await window.webContents.executeJavaScript(`
    new Promise(async (resolve) => {
      const scroller = document.querySelector(".conversation-settings");
      const privacy = Array.from(document.querySelectorAll(".settings-nav button")).find((button) => button.textContent?.includes("隐私与恢复"));
      if (!(scroller instanceof HTMLElement) || !(privacy instanceof HTMLButtonElement)) return resolve({ ok: false });
      scroller.scrollTop = scroller.scrollHeight;
      privacy.click();
      await new Promise((next) => requestAnimationFrame(() => requestAnimationFrame(next)));
      resolve({ ok: scroller.scrollTop <= 1 && Boolean(document.querySelector(".encryption-guidance")) });
    })
  `) as { readonly ok: boolean };
  if (!settingsNavigation.ok) throw new Error("Packaged renderer settings navigation closure failed");
}

export async function verifyPackagedDemoRenderer(
  window: BrowserWindow,
  screenshotDirectory?: string,
): Promise<void> {
  const demoResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 10000;
      let started = false;
      let cleanCancelled = false;
      let details = {};
      const inspect = async () => {
        const taskMap = document.querySelector(".workspace-task-map");
        const taskText = taskMap?.textContent ?? "";
        const mergeButton = Array.from(taskMap?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("打开周期导出 Merge"));
        const cleanButton = Array.from(taskMap?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("用示例开始 Clean"));
        details = { started, cleanCancelled, taskText: taskText.slice(0, 500), mergeButton: mergeButton?.textContent ?? null, cleanButton: cleanButton?.textContent ?? null, body: document.body.innerText.slice(0, 800) };
        if (!started && taskText.includes("Clean") && taskText.includes("Analyze") && taskText.includes("Repeat") && taskText.includes("Compare") && taskText.includes("Reconcile") && taskText.includes("Merge") && !taskText.includes("计划中") && mergeButton instanceof HTMLButtonElement && cleanButton instanceof HTMLButtonElement) {
          started = true;
          cleanButton.click();
          return setTimeout(inspect, 50);
        }
        if (started) {
          const datasets = await window.bubu.datasets.list();
          const groups = await window.bubu.datasetGroups.list();
          const group = groups[0];
          details = { ...details, datasetNames: datasets.map((dataset) => dataset.displayName), group: group ? { name: group.name, members: group.members.length, cadence: group.cadence } : null };
          if (datasets.length === 3 && group?.name === "零售经营周报" && group.members.length === 3 && group.cadence === "weekly") {
            const overview = await window.bubu.datasetRelationships.overview(group.id);
            const names = datasets.map((dataset) => dataset.displayName).sort();
            const expectedNames = ["区域目标", "客户档案", "零售订单"].sort();
            const relationshipsReady = overview.relationships.length === 2 && overview.relationships.every((relationship) => relationship.status === "ready");
            if (JSON.stringify(names) === JSON.stringify(expectedNames) && relationshipsReady) {
              const cleanDialog = document.querySelector(".data-clean-dialog");
              const cancel = Array.from(cleanDialog?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "取消");
              if (!cleanCancelled && cancel instanceof HTMLButtonElement) {
                cleanCancelled = true;
                cancel.click();
                return setTimeout(inspect, 80);
              }
              if (!cleanCancelled) return setTimeout(inspect, 50);
              const groupButton = document.querySelector('button[title="业务主题"]');
              if (groupButton instanceof HTMLButtonElement) groupButton.click();
              return setTimeout(() => {
                const contents = document.body.innerText;
                resolve({ ok: contents.includes("零售经营周报") && contents.includes("3 个数据对象") && contents.includes("每周更新") && !document.querySelector(".data-clean-dialog"), missing: [] });
              }, 180);
            }
          }
        }
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["六个可执行任务入口、Clean 取消或零售示例数据对象、关系与业务主题"], details });
        setTimeout(inspect, 50);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly details?: Readonly<Record<string, unknown>> };
  if (!demoResult.ok) throw new Error(`Packaged renderer retail demo flow failed: ${demoResult.missing.join(", ")} ${JSON.stringify(demoResult.details ?? {})}`);
  await verifySmokeLayout(window, "retail demo");
  await captureSmokeStep(window, screenshotDirectory, "09-retail-demo.png");
}

export async function verifyPackagedMergeRenderer(
  window: BrowserWindow,
  screenshotDirectory?: string,
): Promise<void> {
  const mergeResult = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 15000;
      let started = false;
      let sourceSelected = false;
      let previewed = false;
      let approved = false;
      const inspect = async () => {
        const taskButton = Array.from(document.querySelectorAll(".workspace-task-map button")).find((button) => button.textContent?.includes("打开周期导出 Merge"));
        if (!started && taskButton instanceof HTMLButtonElement) {
          started = true;
          taskButton.click();
          return setTimeout(inspect, 80);
        }
        const dialog = document.querySelector(".data-clean-dialog");
        const text = dialog?.textContent ?? "";
        const datasets = await window.bubu.datasets.list();
        const groups = await window.bubu.datasetGroups.list();
        if (started && datasets.length === 3 && groups[0]?.name === "周期订单合并" && dialog) {
          if (!sourceSelected && text.includes("追加周期导出") && dialog.querySelector(".data-clean-templates .is-selected")?.textContent?.includes("追加周期导出")) {
            const sourceLabel = Array.from(dialog.querySelectorAll("label")).find((label) => label.textContent?.includes("第二数据来源"));
            const select = sourceLabel?.querySelector("select");
            const sourceOption = Array.from(select?.options ?? []).find((option) => option.textContent?.includes("第 2 周订单"));
            if (select instanceof HTMLSelectElement && sourceOption instanceof HTMLOptionElement) {
              sourceSelected = true;
              Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, sourceOption.value);
              select.dispatchEvent(new Event("change", { bubbles: true }));
              return setTimeout(inspect, 100);
            }
          }
          if (sourceSelected && !previewed) {
            const preview = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("预览影响"));
            if (preview instanceof HTMLButtonElement && !preview.disabled) {
              previewed = true;
              preview.click();
              return setTimeout(inspect, 100);
            }
          }
          if (previewed && !approved && text.includes("执行前审查") && text.includes("追加兼容数据") && text.includes("质量门禁通过") && text.includes("第 1 周订单") && text.includes("第 2 周订单")) {
            const approve = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent?.includes("批准并创建数据对象"));
            if (approve instanceof HTMLButtonElement && !approve.disabled) {
              approved = true;
              approve.click();
              return setTimeout(inspect, 100);
            }
          }
        }
        if (approved && datasets.length === 4 && !dialog) {
          const merged = datasets.find((dataset) => dataset.sourceKind === "derived" && dataset.rowCount === 4);
          if (merged) return resolve({ ok: true, missing: [], mergedName: merged.displayName });
        }
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["Merge 任务入口、追加模板、第二来源、影响审查或不可变结果"], text, datasetCount: datasets.length });
        setTimeout(inspect, 80);
      };
      inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly text?: string; readonly datasetCount?: number };
  if (!mergeResult.ok) throw new Error(`Packaged Merge flow failed: ${mergeResult.missing.join(", ")} ${mergeResult.text ?? ""}`);
  await verifySmokeLayout(window, "merge exports");
  await captureSmokeStep(window, screenshotDirectory, "19-merge-result.png");
}

export async function verifyPackagedReconciliationRenderer(window: BrowserWindow, runtime: SidecarSupervisor, fileArrivals: FileArrivalStore, screenshotDirectory?: string): Promise<void> {
  const firstCase = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 15000; let started = false; let previewed = false; let approved = false; let saved = false;
      const inspect = async () => {
        const taskButton = Array.from(document.querySelectorAll(".workspace-task-map button")).find((button) => button.textContent?.includes("打开对账示例 Reconcile"));
        if (!started && taskButton instanceof HTMLButtonElement) { started = true; taskButton.click(); return setTimeout(inspect, 60); }
        const datasets = await window.bubu.datasets.list(); const groups = await window.bubu.datasetGroups.list();
        const dialog = document.querySelector(".reconciliation-dialog"); const text = dialog?.textContent ?? "";
        if (started && datasets.length === 4 && groups[0]?.members.length === 4 && dialog) {
          if (!previewed) { const button = Array.from(dialog.querySelectorAll("button")).find((item) => item.textContent?.includes("预览对账")); if (button instanceof HTMLButtonElement && !button.disabled) { previewed = true; button.click(); return setTimeout(inspect, 60); } }
          if (previewed && !approved && text.includes("执行前审查") && text.includes("控制总额") && text.includes("计划指纹") && text.includes("未决候选不会自动确认")) { const button = Array.from(dialog.querySelectorAll("button")).find((item) => item.textContent?.includes("批准并生成 Reconcile Artifact")); if (button instanceof HTMLButtonElement && !button.disabled) { approved = true; button.click(); return setTimeout(inspect, 60); } }
          if (approved && !saved && text.includes("对账完成") && text.includes("完整结果已原子保存") && text.includes("不平衡") && text.includes("异常与人工处理证据") && text.includes("左侧未匹配") && text.includes("右侧未匹配")) { const button = Array.from(dialog.querySelectorAll("button")).find((item) => item.textContent?.includes("保存为受审下期任务")); if (button instanceof HTMLButtonElement && !button.disabled) { saved = true; button.click(); return setTimeout(inspect, 60); } }
          if (saved && text.includes("已保存为受审下期任务") && text.includes("导出专业报告包")) { const artifact = (await window.bubu.reconciliation.artifacts(groups[0].members.map((item) => item.id)))[0]; return resolve({ ok: true, missing: [], artifactId: artifact?.id, leftDatasetId: artifact?.plan.comparison.sources.left.datasetId }); }
        }
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["销售退款 Reconcile 预览、审批、控制总额或原子 Artifact"], text });
        setTimeout(inspect, 60);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly text?: string; readonly artifactId?: string; readonly leftDatasetId?: string };
  if (!firstCase.ok) throw new Error(`Packaged sales/refunds reconciliation failed: ${firstCase.missing.join(", ")} ${firstCase.text ?? ""}`);
  await verifySmokeLayout(window, "sales refunds reconciliation");
  await captureSmokeStep(window, screenshotDirectory, "14-reconcile-sales-refunds.png");
  if (!firstCase.leftDatasetId) throw new Error("Packaged reconciliation did not return its reviewed source identity");
  const nextSalesPath = join(app.getPath("temp"), `bubu-reconcile-next-${randomUUID()}.csv`);
  await writeFile(nextSalesPath, "Sale ID,Sale Date,Amount,Region\nS-1001,2026-08-01,120.00,华东\nS-1002,2026-08-01,85.50,华南\nS-1003,2026-08-02,210.00,华北\nS-1004,2026-08-02,64.00,华东\n", { mode: 0o600 });
  const replacement = await runtime.replaceDataset(firstCase.leftDatasetId, nextSalesPath);
  if (replacement.status !== "replaced") throw new Error(`Packaged reconciliation replay source replacement failed: ${replacement.status}`);
  const replayed = await runtime.processReconciliationReplayEvents();
  if (replayed.length !== 1 || replayed[0]?.status !== "succeeded" || !replayed[0].artifactId) throw new Error(`Packaged reviewed reconciliation replay failed: ${JSON.stringify(replayed)}`);
  const replayEvidence = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 8000;
      const inspect = () => {
        const dialog = document.querySelector(".reconciliation-dialog");
        const refresh = Array.from(dialog?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "刷新");
        if (refresh instanceof HTMLButtonElement && !refresh.disabled) refresh.click();
        setTimeout(() => {
          const nextDialog = document.querySelector(".reconciliation-dialog"); const text = nextDialog?.textContent ?? "";
          const open = Array.from(nextDialog?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("打开结果"));
          if (open instanceof HTMLButtonElement) { open.click(); return setTimeout(() => resolve({ ok: (document.querySelector(".reconciliation-dialog")?.textContent ?? "").includes("受审任务自动重放") }), 100); }
          if (Date.now() >= deadline) return resolve({ ok: false, text });
          inspect();
        }, 100);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly text?: string };
  if (!replayEvidence.ok) throw new Error(`Packaged reviewed reconciliation replay evidence missing: ${replayEvidence.text ?? ""}`);
  await captureSmokeStep(window, screenshotDirectory, "16-reconcile-reviewed-replay.png");
  const secondCase = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 15000; let openPhase = 0; let selected = false; let previewed = false; let approved = false;
      const inspect = () => {
        let dialog = document.querySelector(".reconciliation-dialog");
        if (openPhase === 0) { const close = dialog?.querySelector('button[aria-label="关闭 Reconcile"]'); if (close instanceof HTMLButtonElement) { openPhase = 1; close.click(); return setTimeout(inspect, 100); } }
        if (openPhase === 1 && !dialog) { const trigger = Array.from(document.querySelectorAll(".group-topic-actions button")).find((button) => button.textContent?.includes("Reconcile")); if (trigger instanceof HTMLButtonElement) { openPhase = 2; trigger.click(); return setTimeout(inspect, 100); } }
        dialog = document.querySelector(".reconciliation-dialog"); const text = dialog?.textContent ?? "";
        if (openPhase === 2 && dialog && !selected) { const selects = dialog.querySelectorAll(".reconciliation-source-grid select"); const left = selects.item(0); const right = selects.item(1); const leftOption = Array.from(left?.options ?? []).find((option) => option.textContent?.includes("订单记录")); const rightOption = Array.from(right?.options ?? []).find((option) => option.textContent?.includes("付款记录")); if (left instanceof HTMLSelectElement && right instanceof HTMLSelectElement && leftOption && rightOption) { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(left, leftOption.value); left.dispatchEvent(new Event("change", { bubbles: true })); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(right, rightOption.value); right.dispatchEvent(new Event("change", { bubbles: true })); selected = true; return setTimeout(inspect, 180); } }
        if (selected && !previewed) { const button = Array.from(dialog?.querySelectorAll("button") ?? []).find((item) => item.textContent?.includes("预览对账")); if (button instanceof HTMLButtonElement && !button.disabled) { previewed = true; button.click(); return setTimeout(inspect, 60); } }
        if (previewed && !approved && text.includes("执行前审查") && text.includes("重复") && text.includes("未决")) { const button = Array.from(dialog?.querySelectorAll("button") ?? []).find((item) => item.textContent?.includes("批准并生成 Reconcile Artifact")); if (button instanceof HTMLButtonElement && !button.disabled) { approved = true; button.click(); return setTimeout(inspect, 60); } }
        if (approved && text.includes("对账完成") && text.includes("右侧重复") && text.includes("未决") && text.includes("完整结果已原子保存")) return resolve({ ok: true, missing: [] });
        if (Date.now() >= deadline) return resolve({ ok: false, missing: ["订单付款 Reconcile 重复/未决 Artifact"], text });
        setTimeout(inspect, 60);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly missing: readonly string[]; readonly text?: string };
  if (!secondCase.ok) throw new Error(`Packaged orders/payments reconciliation failed: ${secondCase.missing.join(", ")} ${secondCase.text ?? ""}`);
  await verifySmokeLayout(window, "orders payments reconciliation");
  await captureSmokeStep(window, screenshotDirectory, "15-reconcile-orders-payments.png");
  const workCenter = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const close = document.querySelector('.reconciliation-dialog button[aria-label="关闭 Reconcile"]');
      if (close instanceof HTMLButtonElement) close.click();
      const deadline = Date.now() + 8000;
      const inspect = () => {
        const center = document.querySelector(".recurring-work-center"); const text = center?.textContent ?? "";
        if (text.includes("周期工作中心") && text.includes("等待新文件") && text.includes("需要处理") && text.includes("已完成") && text.includes("对账") && text.includes("打开证据")) return resolve({ ok: true });
        if (Date.now() >= deadline) return resolve({ ok: false, text });
        setTimeout(inspect, 100);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly text?: string };
  if (!workCenter.ok) throw new Error(`Packaged recurring work center evidence missing: ${workCenter.text ?? ""}`);
  await verifySmokeLayout(window, "recurring work center");
  await captureSmokeStep(window, screenshotDirectory, "17-recurring-work-center.png");
  const arrivalFolder = join(app.getPath("temp"), `bubu-arrivals-${randomUUID()}`);
  await fileArrivals.configure(arrivalFolder);
  const arrivalTarget = (await runtime.listDatasets()).find(({ id }) => id === firstCase.leftDatasetId);
  if (!arrivalTarget) throw new Error("Packaged file-arrival target disappeared");
  const arrivalPath = join(arrivalFolder, basename(arrivalTarget.sourceName));
  await writeFile(arrivalPath, "Sale ID,Sale Date,Amount,Region\nS-2001,2026-09-01,55.00,华东\nS-2002,2026-09-02,75.00,华南\n", { mode: 0o600 });
  await fileArrivals.recordFile(arrivalPath);
  const arrivalProof = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const deadline = Date.now() + 10000; let approved = false;
      const inspect = async () => {
        const inbox = document.querySelector(".arrival-inbox"); const text = inbox?.textContent ?? "";
        if (!approved && text.includes(${JSON.stringify(basename(arrivalTarget.sourceName))}) && text.includes("历史来源一致")) {
          const approve = Array.from(inbox?.querySelectorAll("button") ?? []).find((button) => button.textContent?.includes("确认并创建版本"));
          if (approve instanceof HTMLButtonElement && !approve.disabled) { approved = true; approve.click(); return setTimeout(inspect, 100); }
        }
        const datasets = await window.bubu.datasets.list(); const target = datasets.find((item) => item.id === ${JSON.stringify(firstCase.leftDatasetId)});
        if (approved && target?.version === ${arrivalTarget.version + 1} && text.includes("已创建版本")) return resolve({ ok: true });
        if (Date.now() >= deadline) return resolve({ ok: false, text, version: target?.version });
        setTimeout(inspect, 100);
      }; inspect();
    })
  `) as { readonly ok: boolean; readonly text?: string; readonly version?: number };
  if (!arrivalProof.ok) throw new Error(`Packaged file-arrival review failed: ${JSON.stringify(arrivalProof)}`);
  const arrivalVisualProof = await window.webContents.executeJavaScript(`
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const inbox = document.querySelector(".arrival-inbox");
      const text = inbox?.textContent ?? "";
      resolve({
        ok: document.querySelector(".reconciliation-dialog") === null
          && text.includes(${JSON.stringify(basename(arrivalTarget.sourceName))})
          && text.includes("已创建版本")
          && text.includes("打开版本"),
        text,
        reconciliationOpen: document.querySelector(".reconciliation-dialog") !== null,
      });
    })))
  `) as { readonly ok: boolean; readonly text?: string; readonly reconciliationOpen: boolean };
  if (!arrivalVisualProof.ok) throw new Error(`Packaged file-arrival visual evidence failed: ${JSON.stringify(arrivalVisualProof)}`);
  await verifySmokeLayout(window, "file arrival review");
  await captureSmokeStep(window, screenshotDirectory, "18-file-arrival-reviewed.png");
  console.log("BUBU_PACKAGED_FILE_ARRIVAL_OK");
  if (!firstCase.artifactId) throw new Error("Packaged reconciliation did not expose its report Artifact");
  const reportArtifact = await runtime.getReconciliationArtifact(firstCase.artifactId);
  const reportRoot = join(app.getPath("temp"), `bubu-report-proof-${randomUUID()}`);
  const reportResult = await writeReportBundle({
    schemaVersion: 1, kind: "reconciliation", title: reportArtifact.plan.purpose, summary: "打包应用生成的本地确定性对账报告。",
    deterministicFacts: [{ label: "分类数", value: reportArtifact.completion.classificationCount }, ...reportArtifact.controlTotals.map((total) => ({ label: `${total.id} 差额`, value: total.difference }))],
    tables: [{ name: "对账证据", columns: ["分类", "左侧行", "右侧行", "匹配键", "原因"], rows: reportArtifact.classifications.slice(0, 200).map((item) => [item.category, item.leftRowNumber ?? null, item.rightRowNumber ?? null, item.key, item.reason]) }],
    quality: reportArtifact.sources.map((source) => ({ label: `${source.displayName} 质量分`, value: source.qualityScore })), exceptions: [], limitations: reportArtifact.limitations,
    lineage: reportArtifact.sources.map((source) => ({ label: `${source.side} version`, value: source.versionId })), runMetadata: [{ label: "Artifact", value: reportArtifact.id }, { label: "计划指纹", value: reportArtifact.planFingerprint }],
  }, reportRoot, renderReportPdf);
  const reportFiles = await readdir(join(reportRoot, reportResult.bundleName));
  const reportPdf = await readFile(join(reportRoot, reportResult.bundleName, "report.pdf"));
  if (!reportFiles.includes("report.html") || !reportFiles.includes("report.pdf") || !reportFiles.includes("report.xlsx") || !reportFiles.includes("manifest.json") || !reportFiles.some((name) => name.endsWith(".csv")) || reportPdf.subarray(0, 4).toString() !== "%PDF") {
    throw new Error(`Packaged professional report bundle is incomplete: ${JSON.stringify(reportFiles)}`);
  }
  console.log("BUBU_PACKAGED_PROFESSIONAL_REPORT_OK");
}


export function stopSmokeModelServer(): void {
  smokeModelServer?.closeAllConnections();
  smokeModelServer?.close();
  smokeModelServer = undefined;
}
