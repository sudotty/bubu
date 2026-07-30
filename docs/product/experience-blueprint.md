# Product experience blueprint

Status: current product decision record. It turns first-principles product reasoning into interaction, visual, architecture, and verification rules. Runtime truth still comes from `PRODUCT_MANIFEST.yaml`, boundary parsers, tests, and verifiers.

## North star

BuBu helps a person turn recurring local spreadsheets into trustworthy, repeatable decisions without surrendering raw rows to a model. The product is successful when a user can answer four questions at every moment:

1. **What am I working with?** A named data object, immutable version, or business topic is always visible.
2. **What will happen next?** Model planning, local execution, remote disclosure, and automation are visibly different actions.
3. **Why should I trust the result?** Every result retains its question, typed plan, version identities, local execution evidence, and optional model disclosure.
4. **Can I repeat or change it safely?** A reviewed task can become a versioned workflow without broadening its data, privacy, or execution authority.

This yields the canonical product chain:

```text
file -> data object -> immutable version -> relationship -> business topic
     -> task -> reviewed plan -> local result -> artifact -> workflow -> next result
```

Chat is the intent surface, not the system of record. SQLite-backed objects, plans, results, versions, and audit events are the durable truth. A model proposes typed intent; deterministic code validates and executes it.

## First-principles decisions

### Data is an object, not a contact

The previous “data contact” metaphor made the product friendly but weakened its analytical mental model. An imported sheet is now a **data object**: it has a business name, stable identity, immutable versions, schema, profile, quality rules, relationships, conversations, and lineage. A related 2–8 object collection is a **business topic**. The code may retain `dataset` and `group` as bounded domain terms, but visible product copy uses one consistent object/topic language.

### Intent, authority, and evidence stay separate

- The user supplies intent in natural language or starts from an editable task suggestion.
- The model may translate intent only into a parsed, bounded plan.
- Go remains the final authority for raw data, versions, relationships, privacy disclosure, SQL compilation, execution, workflows, and audit.
- A result artifact contains evidence and presentation; it never silently becomes a new source object.
- An explicit **保存为数据对象** action reruns the approved typed plan in Go and atomically materializes a derived object with parent version IDs and a plan fingerprint.

### Progressive disclosure protects attention

The primary visual order is **entity -> task -> question -> plan approval -> result -> optional follow-up**. Dataset previews, history, full tables, charts, evidence, and workflows live in bounded drawers. AI explanation and the bounded Agent are collapsed after a result because they are optional, higher-cost, and require a second disclosure decision. This prevents the composer from being pushed below the first useful viewport.

### The product starts from tasks, not features

An empty thread offers a small set of implemented task starters—overview, trend, comparison, and bounded detail. Selecting one only fills the composer; it never sends a request. This teaches the product's vocabulary while preserving editability and consent. Planned forecasting, arbitrary formulas, code execution, and writes must not appear as usable starters.

## Product function map

| Product area | User job | Primary surface | Current interaction rule | Product state |
| --- | --- | --- | --- | --- |
| Import | Turn CSV/TSV/XLSX into reliable local data | Data-object list and native picker | Atomic import, local naming, visible row/column/version identity; a bundled retail workspace exercises the same real boundaries | Implemented |
| Versioning | Replace a recurring file without losing history | Object menu and version popover | Same-schema replacement is direct; drift requires explicit mapping | Implemented |
| Quality | Understand whether a version is usable | Data/context result drawer | Profiles, distributions, and saved validation rules stay local | Implemented |
| Relationships | Reuse safe lookup semantics | Business-topic editor | Deterministic relationship discovery; ambiguous joins are rejected | Implemented |
| Query | Convert a question into a local answer | Conversation | Model proposes typed plan; user approves; Go compiles and executes | Implemented |
| Artifact | Inspect, sort, filter, chart, export, and cite a result | Data and result drawer | Full evidence is durable; chat keeps only a five-row preview | Implemented baseline |
| Explanation | Ask a model to explain a safe aggregate | Collapsed result follow-up | Exact aggregate cells are previewed and approved once | Implemented |
| Agent | Perform bounded multi-step aggregate analysis | Collapsed result follow-up | Fixed turns, tools, time, cell scope, and evidence coordinates | Implemented bounded form |
| Workflow | Repeat a reviewed plan | Workflow drawer | Versioned definition, trigger, checkpoint, retry, thread delivery, audit | Implemented baseline |
| Backup/recovery | Move or restore the local workspace | Settings | Validate before atomic replacement; credentials are excluded | Implemented |
| Providers | Configure model access without exposing credentials | Settings | Editable OpenAI, DeepSeek, compatible, and local presets; save and test are separate | Implemented |
| Prompt templates | Reuse input and planning preferences without weakening policy | Settings and composer | Versioned local registry, built-in/custom templates, per-task selection, strict output parsing | Implemented baseline |
| MCP | Inspect and invoke local or HTTPS remote integrations, or request one model-proposed local call | Settings | Save, OAuth, inspect, prompt disclosure, model suggestion, and final tool execution are separate one-use authorities; output never loops back | Implemented bounded form; remote prompt/resource/model use unavailable |
| External reminder | Notify an owned HTTPS Webhook after reviewed work | Workflow panel | Exact workflow version, final human approval, minimal signed payload, bounded retry and revocation | Implemented bounded form |
| Derived objects | Turn A/B/C/D into X/Y with reusable lineage | Result summary and object data inspector | Explicit materialization, immutable output versions, parent snapshots, plan fingerprint, current-parent recompute | Implemented baseline |
| Rich BI reports | Compose reusable multi-visual decision surfaces | Artifact/report mode | Must retain semantic definitions, data alternatives, provenance, and filters | In progress |
| Hub/sync/RBAC | Share explicitly selected encrypted workflow definitions across devices | Optional server and Settings | Four roles, dual permission checks, immutable versions, explicit conflict choice, deletion tombstones and verified signed audit; never required locally | Implemented bounded V1 |

## Information architecture and user journey

```text
App rail
|- Data objects
|  |- object list
|  `- selected object -> task conversation -> data and result drawer -> workflow drawer
|- Business topics
|  |- topic list
|  `- selected topic -> relationship context -> task conversation -> joined result
`- Settings
   |- health and recovery
   |- model providers and privacy ledger
   |- MCP connections and audit
   `- backup and restore
```

The high-frequency journey remains short:

1. Import or select a data object.
2. Start/resume a task; optionally choose an editable task starter.
3. Ask a question and observe a truthful planning state.
4. Review the typed plan and exact outbound context.
5. Approve one local execution.
6. Read the concise result, then open **数据与结果** for the complete table, chart, and evidence.
7. Optionally expand AI explanation, bounded Agent, or finalize the reviewed plan as a workflow.

An empty workspace starts from a truthful task map for **Clean, Compare, Reconcile, Merge, Analyze, and Repeat**. All six tasks are executable through bounded local examples. The Clean entry creates three synthetic objects, two confirmed lookup relationships, and one weekly topic through the production import APIs, then opens the deterministic Clean builder without configuring a model. Compare and Reconcile open bounded sales/refunds or orders/payments cases and enter the reviewed local reconciliation flow. Merge imports three same-schema weekly exports, opens the append template, and requires a second source, impact review, quality proof, and one-use approval before creating an immutable derived object. None of these entries preconfigure credentials, call a model, mutate a non-empty workspace, or alter an input object.

The zero-configuration activation proof is `打开示例 -> Clean -> 预览影响 -> 一次性批准 -> 查看版本执行证据`. Local content-safe metrics record demo start/outcome, Clean preview/result, evidence opening, recovery selection, export, and reviewed-rule replay; they never include file names, paths, questions, prompts, row values, cell values, model output, or thread identity.

At no step may a remote narrative visually outrank the approved local result. Destructive object actions remain in a secondary menu. Settings findings are ordered by blockers, actions, and optional integrations rather than presented as a flat dashboard.

## Visual and interaction system

### Attention hierarchy

1. Active object/topic and active task.
2. Current question and lifecycle state.
3. Approval or recovery action.
4. Local result and direct artifact link.
5. Optional explanations, Agent, workflow, and management actions.

Repeated green badges are not decoration. Green communicates a ready/trusted local action, current selection, or successful state. Warm amber is reserved for review/approval, red for destructive/error states, and graphite for neutral navigation.

### Typography

- Use the native UI sans stack with explicit Chinese fallbacks so macOS and Windows remain legible without pretending an unbundled Inter font exists.
- Use sentence case Chinese labels; reserve uppercase abbreviations for real terms such as AI, API, SQL, MCP, CSV, and BI.
- Use tabular numerals for counts, durations, versions, and table metrics.
- Avoid decorative serif headings in task and data surfaces; hierarchy comes from size, weight, spacing, and content.

### Layout

- The desktop shell keeps a narrow global rail, an entity list only where relevant, and one flexible work area.
- The conversation column targets a readable maximum width; supporting surfaces open as right drawers rather than shrinking the main dialogue into a narrow strip.
- At the supported 920 x 640 viewport, primary controls remain visible without page-level horizontal overflow. Tables, schemas, traces, and charts scroll only inside bounded regions.
- Composer controls remain in normal flow. Optional result follow-ups stay collapsed so they cannot bury the next question.
- Touch targets are at least 40 px for primary interaction controls. Dense metadata may be smaller only when it is not interactive.

### State language

Every async capability shows start, progress, cancellation where supported, terminal outcome, and a safe recovery action. Every capability is one of implemented, disabled with a reason, or planned. There is no silent mock, hidden fallback, or generic “success” that conflates saving, testing, launching, executing, and publishing.

## What the strongest products teach us

The goal is to translate proven interaction principles, not clone another product's brand or information density.

| Reference | Pattern worth adopting | BuBu translation | Pattern not copied |
| --- | --- | --- | --- |
| [Power BI Copilot](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-reports-overview) | AI operates against a semantic model and generated summaries retain visual grounding | Typed plans and future metric definitions ground AI; explanations cite approved cells | Dense report-authoring chrome as the default workspace |
| [Hex AI](https://learn.hex.tech/docs/getting-started/ai-overview) | A conversation can become an inspectable, editable, reusable analytical project | Task -> plan -> artifact -> workflow is explicit and versioned | Notebook/code execution or arbitrary model-authored code |
| [Rows AI Analyst](https://rows.com/docs/using-the-rows-ai-analyst?category=ai) | A side analyst uses checkpoints and cross-table operations while the grid stays inspectable | Optional follow-ups are progressive and joined plans remain visible | Spreadsheet grid as the only mental model |
| [Quadratic SQL connections](https://docs.quadratichq.com/connections/sql-getting-started) | Connected data can be refreshed and reused by formulas or code | Version triggers and workflows refresh reviewed local plans | Live remote SQL as the local system of record |
| [Metabase dashboards](https://www.metabase.com/docs/latest/dashboards/introduction) | A question produces a visualization that can become a reusable dashboard unit | A result artifact deterministically recommends a chart and can become a report block | Auto-selecting a persuasive chart without a suitability explanation |

## Data and engineering decisions

The accepted database/runtime decision is recorded in [ADR 0005](../adr/0005-preserve-go-sqlite-authority-and-gate-analytical-acceleration.md): SQLite remains the local system of record and Go remains the data/privacy authority because the current reference workload is comfortably inside budget. Pure TypeScript owns presentation and product policy when those functions do not require I/O. DuckDB becomes a supervised analytical adapter only after measured workloads justify it; it never becomes a peer source of truth.

Reusable product logic is pure and tested in `@bubu/product-core`: task starters, provider presets, prompt-template resolution, and registry updates. Visualization suitability remains in contracts, while settings health, task lifecycle, and workflow graph projection are pure renderer modules until another host needs them. React components orchestrate state and render; preload exposes named typed capabilities; Electron main owns OS/process operations; sidecars own their contracted authority.

Custom analysis templates are parsed, length-bounded, versioned, and stored in renderer-local product preferences. The selected template travels through the named typed query request, is included in the audited model payload and persisted proposal, and is shown on the approval card. The base system instruction explicitly subordinates it to the safe-plan grammar; a template cannot add raw rows, columns, SQL, tools, output types, joins, or execution authority.

Explicit raw-cell explanation is now a separate progressive-disclosure task, never an extension of query approval. The user chooses exact rows, columns and a purpose; Go produces the authoritative current-version preview and payload fingerprint; Electron binds it to one destination and a ten-minute one-use approval. Strict-private mode always blocks it, local DLP checks both purpose and selected strings, and approval reloads the cells before the audited model call. The response is accepted only when every finding cites an exact disclosed row and column. Default analysis remains zero raw rows, and neither Agent definitions nor workflows inherit this authority.

## Completed recurring-work vertical slice

The first complete derived-object slice is implemented:

1. The strict `DerivedTransformationPlan` union accepts only the existing approved dataset-query or group-query grammar.
2. Go reruns the typed plan against immutable parents; renderer result rows never become persistence input.
3. The output is profiled and atomically stored as a normal `derived` object with immutable version metadata.
4. Every output version records ordered parent version IDs, purpose, typed plan, and SHA-256 plan fingerprint.
5. The data inspector shows lineage and supports recompute-as-new-version against current parents.
6. A derived object can feed another reviewed task, topic, artifact, workflow, or derived object, enabling `A/B/C -> X -> Y`.

The recurring Clean expansion is also implemented: typed select/rename/cast/replace/derive/filter/deduplicate/fill/append/union operations, impact review, versioned quality proof, five editable templates, and automatic dependency replay all preserve the same approval, cardinality, lineage, version, and no-model-SQL boundaries.

Compare/Reconcile now has a complete local product core. Strict versioned `ComparisonPlan` and `ReconciliationPlan` contracts define composite normalized exact keys, reviewed amount/date tolerances, explicit one-to-one or one-to-many cardinality, control totals, unresolved-review policy, candidate/time budgets, pure preview policy, and fail-closed Go classification. Arbitrary SQL/code, fuzzy matching, implicit many-to-many, budget overflow, cancellation, and auto-confirming unresolved candidates are rejected.

The empty workspace can open two bounded reconciliation cases without model configuration: sales/refunds and orders/payments. The renderer collects explicit columns, cardinality and tolerance; Go reads the two current immutable SQLite versions, computes classifications, source quality scores and control totals; Electron issues a one-use approval bound to the full fingerprint; Go recomputes and atomically persists one immutable Reconcile Artifact. The Artifact answers whether totals balance, where differences occur, which rows are duplicated/unmatched/conflicting/pending, and supports bounded current-view copy and CSV export.

A completed one-use Artifact can be saved as a reviewed next-period task. Activating either source's next immutable version enqueues one durable source-pair signature and replays without a model call. Schema drift, increased duplicate/pending cardinality, worse control-total difference, or lower source quality pauses instead of changing reviewed semantics. Successful replay creates exactly one new immutable Artifact linked to the reviewed definition. Interrupted work is recovered on restart; paused/failed work supports bounded retry and cancellation. The owning business topic exposes history and recovery controls, while a privacy-safe global pending entry routes users to the affected topic. Definitions, events and Artifact linkage are validated during backup restore. The separate Merge task is also implemented through the same typed Data Clean append kernel and immutable lineage boundary.

The V1 recurring loop is complete. A user can approve one local folder, receive privacy-safe new-file items, review target recommendations backed by Go source inspection plus pure identity/Schema/profile/history policy, and create one immutable replacement version. A changing file, ambiguous target, or Schema drift pauses before activation. Successful activation reuses the existing Clean, Reconcile, and workflow queues rather than creating another scheduler.

Clean, Reconcile, and reviewed local analysis can deliver an atomic professional report bundle containing standalone HTML, same-source PDF, multi-Sheet XLSX, Excel-safe CSV, and a machine-readable manifest with file hashes. Deterministic facts, quality, exceptions, limitations, lineage, and run metadata remain separate from optional non-authoritative model narrative.

The workspace now also has a unified periodic work center. It derives one current state for every saved workflow, derived recompute target and reviewed reconciliation definition, then orders work requiring attention before running, waiting-file, scheduled and completed evidence. It reuses the existing Go queues and Electron schedulers; the center adds no execution scheduler or generic authority. Every recovery action either retries the exact durable event within its attempt budget or opens the owning product surface.

## Verification contract

For every product change:

- Unit-test pure policy and boundary parsers.
- Add a failing behavior test before import, query, privacy, workflow, sync, or transformation implementation.
- Run TypeScript and Go tests, lint, build, architecture/privacy/product verifiers, and the reference performance gate in proportion to risk.
- Regenerate packaged synthetic screenshots and inspect affected states at the same viewport.
- Treat screenshot review as visual evidence only; keyboard behavior, focus return, privacy authority, cancellation, and recovery require executable checks.
