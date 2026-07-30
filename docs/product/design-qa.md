# Design QA

Result: passed after the 2026-07-26 P0 packaged-journey closure pass

## Comparison basis

- Sources: the three user-provided WeChat/Codex screenshots.
- Product captures: `docs/assets/product/01-datasets.png`, `02-chat.png`, `02-groups.png`, `03-settings.png`, `04-artifact.png`, `05-workflow.png`, `06-derived-object.png`, `07-lineage.png`, `08-output-templates.png`, `09-retail-demo.png`, `10-data-clean-review.png`, and `11-data-clean-result.png`.
- Target viewport: packaged Electron at 920 × 640 CSS pixels (1840 × 1280 Retina capture).
- Intent: adopt the references' conversation hierarchy and progressive disclosure, not clone their brand, content, or unrelated controls.

## Visible review

| Area | Reference signal | BuBu implementation | Result |
| --- | --- | --- | --- |
| Information architecture | Narrow app rail, compact contact/task list, dominant conversation | 60 px graphite rail, 284 px local data-object/topic list, conversation owns the remaining workspace | Pass |
| Top controls | Quiet conversation header with secondary actions at the right | New task, history, result, and workflow are grouped in the conversation's top-right toolbar | Pass |
| Composer | Large, stable input surface at the bottom of the conversation | Flow-positioned bounded composer no longer covers plans or results; privacy scope and keyboard hints remain visible | Pass |
| Progressive disclosure | Supporting content opens beside chat instead of replacing it | History, result, and workflow are focus-managed overlay drawers with backdrop, Escape close, and focus return | Pass |
| Typography | Neutral system type with clear hierarchy | System sans-serif, compact labels, strong entity/task names, restrained metadata; no decorative display hierarchy | Pass |
| Spacing and density | Tight navigation, generous message area | 8–16 px navigation rhythm, 20–44 px conversation gutters, bounded cards, no dashboard tile wall | Pass |
| Color | Neutral shell with a single recognizable action state | Graphite rail, warm-white canvas, muted green selection/trust/action state, warning colors reserved for approval/failure | Pass |
| Icons/assets | Familiar monochrome utility icons | Installed Lucide icons only; no emoji, handmade SVG, CSS illustration, or placeholder asset | Pass |
| Copy | Conversation actions are short and task-oriented | Chinese labels state authority and scope: 本地执行, 历史, 结果, 工作流, 保存为工作流 | Pass |
| Workflow | Supporting work stays connected to the conversation | Static/dynamic typed node graph shows trigger, local processing, conversation delivery, and next update | Pass |
| Result → object | Reusable output is a deliberate progression, not an accidental export | A typed query result opens a compact “保存为数据对象” form, creates a catalog object, and switches context only after materialization succeeds | Pass |
| Version lineage | Derived work must explain where it came from and how it changes | The derived-object inspector leads with immutable upstream versions, plan purpose/fingerprint, current output version, and a bounded recompute action | Pass |
| Output templates | Presentation preferences must not silently expand model authority | Processing and aggregate-output templates are separated; the selected output template is visible in disclosure review and bound to the one-use approval | Pass |
| Retail demo | The first-run example must prove a real product job, not show static sample cards | The packaged app imports three local objects, confirms two relationships, creates the weekly topic, and opens the resulting business workspace | Pass |

## Issue closure

- The active plan/result is isolated to entries after the latest question; completed plans no longer render as pending approval or duplicate history.
- Empty result and workflow drawers now explain the missing prerequisite and return directly to the conversation.
- Settings diagnostics fail closed on partial reads, section navigation resets scroll, and encryption remediation reaches an explanatory destination.
- Context menus provide arrow, Home/End, Tab, Escape, outside-dismiss, and deterministic focus behavior; native text-input context menus are preserved.
- Workflow scheduling exposes the exact local time, weekday, or month day before save; manual mode never claims an automatic trigger.
- MCP executable selection uses an Electron-owned native file picker and the same strict direct-executable contract as typed input.
- P0: 0 known open in the captured local flow.
- P1: 0 known open in the captured local flow.
- Packaged smoke proves horizontal containment for the main workspace, result inspector, chart, workflow inspector, and workflow panel. It rejects retained horizontal scroll at the workbench-layout, inspector, and panel boundaries and checks primary child geometry.
- Packaged smoke materializes a real derived object through the renderer/main/Go boundary, opens its lineage, clicks the current-upstream recompute control, and verifies immutable version 2 in the notice, lineage, and catalog.
- Packaged smoke opens and cancels Data Clean, reopens it, creates a blocked quality review, verifies that activation is disabled, revises the policy, approves the passing review, observes the real derived object, and opens its persisted version execution and rule-level quality proof.
- Packaged smoke saves, selects, updates and deletes a reusable bounded Agent definition through the renderer/main private-store boundary; it also configures report title, summary and inclusion switches, then switches a multi-metric chart and proves the schema-bound preference is restored after remount.
- Packaged smoke validates a credential-free product-setting bundle through the real private-store boundary and renders the lightweight first-run checklist. The next-task recommendation uses only column names, inferred types and null counts; it does not inspect full rows or call a model.
- Packaged smoke creates and selects a custom aggregate-output template, then starts from a fresh profile and imports the bundled retail demo through the visible empty-state action before checking all three objects, both ready relationships, and the weekly topic.
- Current-run visual inspection found no cropped primary control or misleading task/schedule state at the target viewport.

## Interaction evidence

The packaged journey verifies lightweight onboarding and structure-driven task recommendation, credential-free setting migration, task/history/result/workflow drawer state, native composer context behavior, data-object and conversation menus, focus transfer, Escape close, Artifact tab keyboard navigation, empty-result semantics, current-view actions, completed-task copy, business-topic rendering, settings scroll restoration, encryption guidance, manual workflow copy, save-button containment, reusable Agent-definition lifecycle, multi-metric preference restoration, configurable report composition, the persisted dynamic workflow graph, derived-object materialization and recompute, immutable lineage rendering, Data Clean cancel/review/approve/materialize, output-template persistence, and retail-demo setup. Screenshots supplement these executable checks; they are not treated as their substitute.
