# Design QA

Result: passed

## Comparison basis

- Sources: the three user-provided WeChat/Codex screenshots.
- Product captures: `docs/assets/product/01-datasets.png`, `02-chat.png`, `02-groups.png`, `03-settings.png`, `04-artifact.png`, and `05-workflow.png`.
- Target viewport: packaged Electron at 920 × 640 CSS pixels (1840 × 1280 Retina capture).
- Intent: adopt the references' conversation hierarchy and progressive disclosure, not clone their brand, content, or unrelated controls.

## Visible review

| Area | Reference signal | BuBu implementation | Result |
| --- | --- | --- | --- |
| Information architecture | Narrow app rail, compact contact/task list, dominant conversation | 60 px graphite rail, 284 px local data-object/topic list, conversation owns the remaining workspace | Pass |
| Top controls | Quiet conversation header with secondary actions at the right | New task, history, result, and workflow are grouped in the conversation's top-right toolbar | Pass |
| Composer | Large, stable input surface at the bottom of the conversation | Sticky bounded composer remains visible in dataset and group journeys without page overflow | Pass |
| Progressive disclosure | Supporting content opens beside chat instead of replacing it | History, result, and workflow are focus-managed overlay drawers with backdrop, Escape close, and focus return | Pass |
| Typography | Neutral system type with clear hierarchy | System sans-serif, compact labels, strong entity/task names, restrained metadata; no decorative display hierarchy | Pass |
| Spacing and density | Tight navigation, generous message area | 8–16 px navigation rhythm, 20–44 px conversation gutters, bounded cards, no dashboard tile wall | Pass |
| Color | Neutral shell with a single recognizable action state | Graphite rail, warm-white canvas, muted green selection/trust/action state, warning colors reserved for approval/failure | Pass |
| Icons/assets | Familiar monochrome utility icons | Installed Lucide icons only; no emoji, handmade SVG, CSS illustration, or placeholder asset | Pass |
| Copy | Conversation actions are short and task-oriented | Chinese labels state authority and scope: 本地执行, 历史, 结果, 工作流, 收尾为工作流 | Pass |
| Workflow | Supporting work stays connected to the conversation | Static/dynamic typed node graph shows trigger, local processing, conversation delivery, and next update | Pass |

## Issue closure

- P0: 0 open.
- P1: 0 open.
- P2: 0 open.
- Packaged smoke proves horizontal containment for the main workspace, result inspector, chart, workflow inspector, and workflow panel.
- Source/prototype comparison found no remaining broken layout, cropped primary control, inaccessible core interaction, or misleading capability state at the target viewport.

## Interaction evidence

The packaged journey verifies task/history/result/workflow drawer state, right-click conversation actions, focus transfer, Escape close, Artifact tab keyboard navigation, current-view actions, business-topic rendering, settings navigation, and the persisted dynamic workflow graph. Screenshots supplement these executable checks; they are not treated as their substitute.
