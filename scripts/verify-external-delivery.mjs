import { readFileSync } from "node:fs";
import { loadProductManifest, requireManifestFacts } from "./product-manifest.mjs";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); const failures = [];
const requireText = (path, values, label) => { const source = read(path); for (const value of values) if (!source.includes(value)) failures.push(`${label} missing: ${value}`); };
requireText("packages/contracts/src/external-delivery.ts", ["workflow.completed", "destination.test", "credential-free HTTPS", "retry-wait"], "delivery contracts");
requireText("packages/product-core/src/external-delivery-policy.ts", ["30_000", "120_000", "attempts >= 3"], "bounded retry policy");
requireText("apps/desktop/src/main/external-delivery-service.ts", ["createHmac", "resolveTarget", "fetchResolvedPublicTarget", "dedupeKey", "DESTINATION_REVOKED", "enqueueApprovedRun"], "secure delivery adapter");
requireText("apps/desktop/src/main/external-delivery-api.ts", ["final human-approval", "definition.version", "testWebhookDestination"], "version-bound API");
requireText("apps/desktop/src/main/workflow-api.ts", ["enqueueApprovedRun", 'input.decision === "approved"', 'run.status === "succeeded"'], "approval gate");
requireText("apps/desktop/src/renderer/WorkflowPanel.tsx", ["不发送原始行", "只保存，不发送", "最多 3 次", "renderer 不可读取"], "truthful delivery UI");
requireText("apps/desktop/src/main/packaged-smoke.ts", ["BUBU_PACKAGED_EXTERNAL_DELIVERY_OK"], "packaged delivery journey");
requireText("docs/product/external-delivery-reminders.md", ["one-use human approval", "15-second", "BUBU_PACKAGED_EXTERNAL_DELIVERY_OK"], "current delivery guide");
requireManifestFacts(loadProductManifest(new URL("..", import.meta.url)), ["external-delivery-reminders: implemented", "approval-bound-webhook-delivery: implemented", "packaged-external-delivery-profile-journey: implemented"], failures, "manifest delivery truth");
if (failures.length) { console.error(`External delivery verification failed:\n\n- ${failures.join("\n- ")}`); process.exit(1); }
console.log("External delivery verified: encrypted destination, exact workflow-version approval, minimal HMAC payload, SSRF policy, dedupe, bounded retry/revocation, and packaged UI evidence.");
