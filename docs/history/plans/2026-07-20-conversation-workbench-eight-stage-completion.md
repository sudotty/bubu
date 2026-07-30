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
- The test suites pass with 78 contract, 34 AI-runtime, and 101 desktop tests, plus all Go packages.
- The packaged desktop smoke verifies both compact drawer state transitions and the imported-data, group, chat, and settings journeys.
- Four synthetic product screenshots were regenerated and visually reviewed at the supported 920 × 640 viewport.
- The 100 MiB / 100k+ row reference fixture remains inside the checked-in import, query p95, and peak-RSS budgets; closure uses the current verifier output rather than preserving one machine sample as a timeless claim.
- The new `verify:product-experience` gate prevents drift in conversation hierarchy, workflow/thread ownership, Artifact semantics, settings health, keyboard behavior, and compact reflow.

## Product decisions now settled

The former second-review choices are resolved as product policy:

1. Chat remains the permanent primary surface. Wide mode shows tasks/chat/Artifact, medium mode preserves tasks/chat and treats Artifact as support, and compact mode moves **任务** and **结果** into focus-managed drawers based on available container width rather than a device label.
2. Artifact owns full result use: current-view copy, formula-safe current-view CSV export, local pinning, deterministic chart/data alternative, evidence, and a bounded script-free HTML report. The chat keeps only a short result preview and direct navigation.
3. Visualization remains deliberately deterministic and narrow. Bar and chronological time-series charts are implemented; unsupported/high-cardinality shapes remain tables with an explanation. BuBu does not become a free-form dashboard or WYSIWYG report editor.
4. Release distribution is GitHub draft Releases with macOS DMG+ZIP and Windows Squirrel, protected Developer ID/API-key notarization and Azure OIDC signing, immutable action pins, no unsigned fallback, and no automatic updates until signed update/rollback proof exists.
5. Windows x64 and macOS arm64/x64 are stable targets; Windows arm64 stays preview-only, while ia32 and Linux are outside this beta contract.
6. `bubu-bi` remains read-only migration evidence until every inventory slice is explicitly migrated or retired; then the Wails runtime and generated bridge are deleted together from a clean reviewed tree.

Observed usability, screen-reader/comprehension sessions, real signing identities, and clean-device Gatekeeper/SmartScreen acceptance remain external evidence requirements. They are not unresolved product-direction choices and cannot be honestly manufactured by repository code.

The manifest remains the authority for capabilities outside this eight-stage conversation-workbench scope, including privacy gateway, workflows, bounded agents, MCP host, reminders, sync, RBAC, and hub work that is still in progress or planned.
