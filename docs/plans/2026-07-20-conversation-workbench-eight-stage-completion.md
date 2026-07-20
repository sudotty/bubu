# Conversation workbench eight-stage completion

Status: implementation complete; product-owner decisions remain intentionally separate from the verified engineering scope.

## Delivered stages

| Stage | Outcome | Commit |
| --- | --- | --- |
| 1 | Bound reusable workflows and triggered evidence to the exact conversation thread that owns the reviewed plan | `b66ae51` |
| 2 | Made the conversation the primary dataset and group workspace instead of placing it below management and preview surfaces | `6ffca7a` |
| 3 | Completed task creation, first-question naming, rename, archive, undo, archived browsing, restore, and persisted task resume | `2aaa02e` |
| 4 | Refined the Chat/Codex-style flow with causal task state, trust disclosure, keyboard submission, retry, and edit recovery | `2c6fe78` |
| 5 | Turned Artifact into an inspectable summary, data, visual, evidence, and expanded automation workspace | `12c5470` |
| 6 | Added settings health, credential-state truth, and guided backup/recovery orientation | `421d367` |
| 7 | Added semantic visual states, keyboard tab behavior, compact task/result drawers, reduced motion, and responsive containment | `cbf4501` |
| 8 | Aligned README levels, product guidance, screenshots, packaged smoke, static product verification, and the full repository gate | this commit |

## Final engineering review

- `npm run verify` passes across toolchain, repository hygiene, dependency audit, TypeScript tests, Go tests, architecture, documentation, product experience, lint, production packaging, data-core/MCP/desktop smoke, and the reference performance gate.
- The test suites pass with 69 contract, 34 AI-runtime, and 84 desktop tests, plus all Go packages.
- The packaged desktop smoke verifies both compact drawer state transitions and the imported-data, group, chat, and settings journeys.
- Four synthetic product screenshots were regenerated and visually reviewed at the supported 920 × 640 viewport.
- The 100 MiB reference fixture imported and profiled in 3.90 seconds; bounded-query p95 was 163.23 ms; data-core peak RSS was 37.70 MiB.
- The new `verify:product-experience` gate prevents drift in conversation hierarchy, workflow/thread ownership, Artifact semantics, settings health, keyboard behavior, and compact reflow.

## Product-owner review queue

These items are not hidden engineering failures. They require an explicit product or release decision:

1. Approve the compact-width rule that keeps chat permanently central and moves **任务** and **结果** into drawers at 1280 px and below.
2. Decide whether Artifact needs copy/export/pinning actions beyond the current sortable and filterable local table.
3. Choose whether the next visualization milestone expands the deterministic chart catalogue or prioritizes report composition; the manifest still marks visualizations in progress and reports planned.
4. Schedule observed usability and assistive-technology sessions. Automated keyboard, focus, motion, and containment checks do not replace human screen-reader and comprehension review.
5. Decide the release path for signed installers and updates. `signed-installers` remains planned and `signed-artifacts` remains a release gate.
6. Decide when the legacy `bubu-bi` migration source is retired after remaining vertical slices move to Electron; this work intentionally did not alter unrelated local legacy changes.

The manifest remains the authority for capabilities outside this eight-stage conversation-workbench scope, including privacy gateway, workflows, bounded agents, MCP host, reminders, sync, RBAC, and hub work that is still in progress or planned.
