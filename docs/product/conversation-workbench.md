# Conversation workbench

BuBu treats a conversation as a durable local data task, not a disposable model transcript. One dataset or group can own multiple independent threads without mixing questions, reviewed plans, results, explanations, automated runs, or audit evidence.

## Primary flow

1. Select a dataset contact or a 2–8 member group.
2. Start or resume a task. The first question becomes the default title; the title can be edited later.
3. Ask a question. Enter submits and Shift+Enter adds a line break.
4. Review the exact typed plan and disclosure boundary.
5. Approve once. The Go data core validates and executes the bounded plan locally.
6. Read the concise response in the chat and inspect the durable result in the Artifact workspace.
7. Optionally save the reviewed plan as a workflow. The definition and every triggered result remain bound to the originating thread.

Errors retain a recovery path: retry plan generation or return the submitted text to the composer for editing. Reopening a thread derives a typed lifecycle from its append-only history—draft, planning, awaiting approval, executing, completed, needs attention, or cancelled—so a completed task does not appear idle after restart. A persisted question without a following plan is treated as an interrupted task and offers retry/edit actions using the saved question. Cancellation is terminal for the current operation but does not claim to roll back or delete earlier records.

## Workspace responsibilities

- **Tasks:** create, select, rename, archive, undo archive, browse archived threads, and restore.
- **Chat:** questions, plan review, approval, execution state, failure recovery, and a sticky composer.
- **Artifact:** summary metrics, local result data with filtering and sorting, deterministic visualization, and an event evidence timeline.
- **Automation:** an expanded work area launched from the Artifact summary. A workflow stores the source `threadId`; target-only fallback delivery is forbidden.

The workbench adapts to its own available width rather than a device label. Wide mode keeps tasks, chat, and Artifact together. Medium mode keeps tasks beside chat and opens Artifact as a supporting panel. Compact mode preserves chat as the primary pane and opens **任务** or **结果** as keyboard-accessible drawers. Empty chat states include a direct task-creation action and never refer to a possibly hidden “left side.” The product contract requires bounded internal scrolling and no page-level horizontal overflow at the packaged 920 × 640 minimum.

The center timeline uses one stable message grammar: user prompts are right-aligned bubbles; assistant narration is a calm, unboxed response with a BuBu marker; transient system/tool activity is a compact status row; typed plans are the only warm approval cards; failures are recovery cards with the next safe actions; and local results appear as five-row previews that point to the durable Artifact workspace. English decorative kickers are not used to simulate product hierarchy.

## Trust model

The question text is model input and must not contain pasted sensitive rows. Automatically prepared context is limited to the disclosure shown in the review. Remote model planning, deterministic local execution, and optional aggregate explanation are different events with separate authority and audit records.

The Artifact evidence timeline is append-only orientation, not permission. Reusing a plan through automation does not broaden its data target, disclosure level, thread ownership, retry budget, or execution authority.
