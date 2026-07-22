# BuBu Product and Platform Roadmap

Status: **Strategic roadmap**

Baseline branch: `codex/bubu-productization`

Baseline commit when this roadmap was written: `6d05e0ee76fb986acaf161de7f45f66e58d9e356`

This document defines product direction, sequencing, commercial hypotheses, architectural destinations, and delivery gates. It does **not** declare a capability shipped. `PRODUCT_MANIFEST.yaml`, runtime behavior, tests, verifiers, release evidence, and current product documentation remain the authorities for what works now.

---

## 1. Executive decision

BuBu will not compete as another generic chatbot, another cloud spreadsheet, another dashboard builder, or another model wrapper.

BuBu will become a **local-first private data agent for recurring spreadsheet work**, and later a **private data runtime that any AI agent can call**.

The durable product contract is:

> Models understand intent and propose plans. Deterministic code executes. The Go data core decides. The user authorizes. The ledger proves. Workflows preserve and repeat successful work.

The near-term product wedge is deliberately narrow:

1. **Clean** recurring Excel and CSV files.
2. **Reconcile** files, systems, and versions.
3. **Repeat** the reviewed task when the next file or dataset version arrives.

The long-term platform position is broader:

> WorkBuddy, TRAE Work, Codex, Claude Code, Gemini CLI, GitHub Copilot, local models, cloud models, and future agents may think and coordinate; BuBu remains the trusted local authority for spreadsheet data, deterministic execution, evidence, lineage, and repeatable workflows.

---

## 2. Current baseline

The current productization branch already establishes a substantial and unusually conservative foundation.

### 2.1 Product and data foundation

- Atomic CSV, TSV, and XLSX import.
- Custom local data-object names.
- Immutable dataset replacement and version history.
- Same-schema replacement.
- Schema-drift detection and explicit mapping.
- Bounded preview, profiling, distributions, and data-quality rules.
- Dataset groups representing business topics.
- Reusable lookup relationships and bounded multi-table analysis.
- Conversation threads owned by a dataset or business topic.
- Recoverable local task state, cancellation, errors, and restart resume.
- Artifact workspace for summary, data, visualization, evidence, export, pinning, and workflow state.
- Manual, interval, and dataset-version workflow triggers.
- Static and dynamic workflow graphs.
- Backup, restore, permanent deletion, and hardened CSV export.

### 2.2 Trust and execution foundation

- Sandboxed React renderer.
- Narrow typed preload instead of a generic bridge.
- Electron main as process and operating-system supervisor.
- Go data core as the authority for files, database execution, privacy, schedules, and audit.
- Supervised Node utility process for model-provider and MCP protocol work.
- Typed query plans instead of model-authored SQL execution.
- Visible query and disclosure review.
- Schema-only, synthetic, and bounded aggregate disclosure levels.
- Fail-closed model audit and append-only disclosure ledger.
- OS-encrypted provider and MCP credentials.
- One-use MCP process, resource, prompt, and tool approvals.
- Bounded aggregate agent runs with fixed model, tool, and time budgets.
- Named cancellation and operation deadlines.

### 2.3 Release and engineering foundation

- Versioned contracts across process boundaries.
- Repository, architecture, documentation, product, privacy, release, and legacy verifiers.
- macOS arm64/x64 and Windows x64 package pipelines.
- Native lifecycle smoke coverage.
- Deterministic release asset names, checksums, SBOMs, and optional provenance.
- A deterministic 100 MiB reference performance gate.
- Product screenshots generated from synthetic data.

### 2.4 Baseline imbalance

The baseline is stronger in control than in user-value breadth:

| Area | Current relative maturity | Strategic interpretation |
| --- | --- | --- |
| Privacy and disclosure | High | Preserve as a differentiator and product language |
| Deterministic query execution | High | Generalize into more plan types |
| Dataset versions and recovery | High | Use as the basis of repeatable work |
| Conversation and Artifact | Medium-high | Keep, but make task entry more concrete |
| Workflow durability | Medium | Expand node types and completion verification |
| Query analysis | Medium | Extend analytical functions only after transformations |
| Data transformation | Low | Highest-priority product gap |
| Reconciliation | Low | Highest-value vertical wedge |
| Reports and delivery | Low-medium | Required to complete user jobs |
| Local semantic layer and RAG | Planned | Build after transformations and lineage |
| External agent runtime | Early | Build after core local jobs are strong |
| Team and enterprise control | Planned | Defer until individual retention is proven |

The immediate objective is therefore not more autonomous reasoning. It is to turn the trusted execution substrate into a product that removes recurring manual spreadsheet work.

---

## 3. Product thesis

### 3.1 The problem

Millions of recurring business processes still follow this pattern:

`receive file → rename columns → fix types → remove duplicates → join another file → check totals → create a chart → export a report → repeat next week or month`

Excel is flexible but does not naturally provide durable task state, immutable versions, execution evidence, workflow recovery, privacy-aware AI disclosure, or a stable cross-file semantic layer.

Traditional BI is strong for governed dashboards but often begins too late in the process. Many users first need to clean inconsistent exports, reconcile files, repair schema changes, and create one deliverable without building a warehouse.

Cloud data agents reduce friction but normally centralize data, use opaque credits, couple users to a provider-selected model, or treat a conversation answer as the final product.

### 3.2 The product promise

BuBu should make this promise understandable without requiring users to know MCP, RAG, agent loops, SQL safety, or context engineering:

> Stop repeating spreadsheet work. Clean, reconcile, analyze, deliver, and rerun Excel and CSV tasks locally. Raw rows stay on the device by default.

### 3.3 The category

Primary category:

- **Private Data Agent**

Secondary technical category:

- **Local-first Data Runtime for AI Agents**

Supporting descriptions:

- Private data workspace.
- Spreadsheet workflow agent.
- Local data operations platform.
- Evidence-first analytical workspace.

### 3.4 Product principles

1. **Local-first, not local-only.** Data authority stays local; users may choose local or remote models.
2. **No raw-row upload by default.** A higher disclosure level always requires explicit policy and review.
3. **Plans, not arbitrary code.** Models produce typed plans; deterministic engines validate and execute them.
4. **Tasks, not chat transcripts.** A thread owns intent, plans, results, evidence, recovery, and automation.
5. **Artifacts, not prose alone.** The product delivers tables, derived datasets, charts, reports, evidence, and workflows.
6. **Workflow before agent.** Predetermined work remains deterministic; agents handle bounded uncertainty.
7. **Evidence before confidence.** Results include provenance, checks, limitations, and completion proof.
8. **Model neutrality.** Users can bring a provider, gateway, local model, or managed model.
9. **Open data, compounding intelligence.** Data and workflow definitions are exportable; value compounds through schema memory, rules, history, and verified runs.
10. **One kernel, many entry points.** Acquisition products and integrations share the same data core and capability model.

---

## 4. Market position and competitive strategy

BuBu should not attempt feature parity with every adjacent product.

### 4.1 Products BuBu complements

| Product class | What it does well | BuBu's complementary role |
| --- | --- | --- |
| Excel and Google Sheets | Editing, formulas, flexible final-mile work | Cross-file preparation, repeatability, evidence, and controlled AI |
| Power BI and enterprise BI | Governed models, dashboards, organizational sharing | Pre-BI cleanup, reconciliation, recurring file workflows, local-first operation |
| Rows and AI spreadsheets | Cloud collaboration and spreadsheet-native AI | Local control, provider neutrality, immutable versions, evidence, repeatable tasks |
| Julius and cloud data agents | Broad cloud analysis, notebooks, reports, connectors | Private local execution, typed plans, deterministic workflow, cross-agent runtime |
| WorkBuddy and TRAE Work | General office tasks, research, cross-system coordination | Specialist local data execution and evidence |
| Codex, Claude Code, Gemini CLI, Copilot | Coding, automation, connector and workflow creation | Safe data tools, CLI, MCP, skills, fixtures, and artifacts |
| RPA and browser agents | Interacting with systems lacking APIs | Validated data preparation before or after the fragile UI step |

### 4.2 Battles BuBu should avoid

- Do not claim the strongest general-purpose model.
- Do not recreate the complete Excel editing surface.
- Do not compete on the largest chart catalog.
- Do not build a cloud warehouse before proving local recurring work.
- Do not expose arbitrary shell, SQL, or filesystem access as a shortcut.
- Do not build an unbounded multi-agent swarm before reliable single-task execution.
- Do not make MCP configuration the main user experience.
- Do not build enterprise collaboration before individual activation and retention.

### 4.3 Defensible assets

The defensible product is not the chat UI. It is the compounding system of:

- Local data authority.
- Immutable versions.
- Schema mappings and drift history.
- User-confirmed business meanings.
- Validation rules.
- Transformation definitions.
- Derived dataset lineage.
- Workflow definitions and run history.
- Completion evidence.
- Privacy and model disclosure ledger.
- Domain task templates.
- Cross-agent capability packs.
- Real spreadsheet-task evaluation fixtures.

---

## 5. Target users and jobs

### 5.1 Primary users

- Finance and accounting operators.
- Ecommerce operators and sellers.
- Marketing operations and agencies.
- Sales operations and revenue operations.
- Analysts and independent consultants.
- Operations managers in small and medium businesses.
- Researchers and investors handling repeated exports.
- HR, healthcare administration, education administration, and regulated back-office teams.

### 5.2 Universal jobs

The product should be organized around seven universal verbs rather than technical subsystems:

1. **Clean** — repair formats, missing values, duplicates, and inconsistent columns.
2. **Compare** — explain differences between files, versions, periods, or systems.
3. **Merge** — append and join files safely.
4. **Reconcile** — identify matches, duplicates, omissions, and amount differences.
5. **Analyze** — calculate, segment, rank, trend, and detect anomalies.
6. **Report** — deliver a usable table, workbook, chart, PDF, HTML report, or evidence pack.
7. **Repeat** — recognize the next version, handle drift, rerun the reviewed workflow, and verify completion.

### 5.3 Initial high-value use cases

- Sales and refund reconciliation.
- Bank statement and ledger reconciliation.
- Invoice and payment matching.
- Customer-list cleanup and deduplication.
- Multi-channel ecommerce order consolidation.
- Monthly marketing performance reports.
- Inventory health and stock exception reports.
- Supplier-price comparisons.
- App-store and advertising revenue reports.
- Survey and operational export cleanup.
- Monthly financial and management reporting.

---

## 6. Product matrix

The matrix is a distribution and packaging strategy, not a mandate to maintain independent codebases.

### 6.1 Acquisition modes

These may have separate landing pages, onboarding flows, templates, or lightweight launch modes while sharing the same installer, local catalog, data core, and account.

#### BuBu Clean

- Detect and repair column types.
- Normalize dates, currency, text, and identifiers.
- Remove duplicates and empty rows.
- Fill, replace, split, and merge values.
- Preview impact before execution.
- Export a cleaned workbook or derived dataset.

#### BuBu Compare

- Compare two files or dataset versions.
- Show added, removed, modified, and duplicate rows.
- Show schema changes and amount differences.
- Export a bounded difference report.

#### BuBu Reconcile

- Match two or more sources.
- Exact, tolerance-based, and approved fuzzy matching.
- Identify unmatched, duplicated, and conflicting records.
- Verify row counts and total balances.
- Produce an evidence-first reconciliation report.

#### BuBu Privacy Scanner

- Detect likely PII, secrets, identifiers, and sensitive columns.
- Explain what a model disclosure would contain.
- Recommend local, synthetic, aggregate, redacted, or explicit-row handling.
- Produce a privacy report before data is sent to another AI product.

### 6.2 Core product: BuBu One

BuBu One is the primary desktop product:

- Data objects and business topics.
- Task conversations.
- Typed plans.
- Local deterministic execution.
- Artifacts and evidence.
- Reusable workflows.
- Model and provider selection.
- Privacy controls and disclosure ledger.

### 6.3 Professional product: BuBu Studio

BuBu Studio serves advanced users, consultants, developers, and implementation partners:

- Visual transformation-plan builder.
- Workflow graph editor.
- Skill authoring.
- Connector and MCP mapping.
- Test fixtures and evaluation runner.
- Report and template authoring.
- Pack compiler and publisher.
- CLI and SDK tooling.

### 6.4 Integration product: BuBu Runtime

BuBu Runtime exposes safe local data capabilities to external agents:

- Local MCP server.
- CLI.
- SDK.
- Artifact protocol.
- Approval deep links.
- Workflow invocation.
- Capability discovery and policy filtering.

### 6.5 Team product: BuBu Hub

BuBu Hub is a later optional control plane:

- Organization and identity.
- Device enrollment.
- RBAC and ABAC.
- Policy distribution.
- Approved model and connector catalogs.
- Shared workflow and template metadata.
- Audit aggregation.
- Optional encrypted metadata or snapshot synchronization.

Local mode must never require Hub.

---

## 7. North-star metric and product measures

### 7.1 North-star metric

> **Weekly successful repeatable data tasks**

A task counts only when:

- the intended input was identified;
- the plan was reviewed or matched a previously approved workflow;
- deterministic execution completed;
- required validations passed or were explicitly acknowledged;
- a usable Artifact was produced;
- the result can be repeated or was produced by an existing repeatable workflow.

### 7.2 Activation funnel

- Install or launch.
- Import first file.
- Complete first useful inspection.
- Select a concrete task or ask a question.
- Review a plan.
- Obtain a local result.
- Export, copy, pin, or use the Artifact.
- Save or reuse a workflow.

### 7.3 Retention measures

- Workflow save rate.
- Workflow repeat rate.
- Dataset replacement rate.
- Schema-drift recovery rate.
- Monthly active workflows.
- Successful triggered runs.
- Return to existing task threads.
- Artifact export and report delivery.
- Estimated manual time saved.

### 7.4 Reliability measures

- Query-plan acceptance and correction rate.
- Transformation-plan acceptance and correction rate.
- Reconciliation precision, recall, and unresolved rate.
- Validation pass rate.
- Join-amplification incidents.
- Workflow idempotency failures.
- Unknown external side-effect states.
- Privacy-policy violations.
- Cross-thread delivery violations.
- Recovery success after cancellation, crash, or restart.

### 7.5 Market measures

- Free-to-paid conversion.
- Local-license conversion.
- Annual-plan share.
- Template activation.
- External-agent referral rate.
- Search-driven acquisition.
- Consultant-created workspaces.
- Business-pack attach rate.

---

## 8. Prioritization framework

Every proposed feature should be scored against five questions:

1. Does it remove recurring manual spreadsheet work?
2. Does it strengthen privacy, reliability, evidence, or repeatability?
3. Can it be reused across industries?
4. Can it be exposed safely to external agents?
5. Can its success be verified with deterministic tests and fixtures?

Features should be deprioritized when they mainly increase visible breadth, model autonomy, or configuration surface without improving a high-frequency user outcome.

Priority labels:

- **P0** — blocks a sellable and trustworthy core journey.
- **P1** — materially improves retention, repeatability, or professional use.
- **P2** — expands distribution, extensibility, or larger-data capability.
- **P3** — team, enterprise, and ecosystem scale.
- **Explore** — research with no delivery commitment.
- **Not now** — explicitly deferred to protect focus.

---

## 9. Delivery horizons

| Horizon | Product outcome | Main proof |
| --- | --- | --- |
| Horizon 0 | Signed, measurable public beta baseline | Clean-device install, upgrade, restore, and first-task evidence |
| Horizon 1 | Clean, Reconcile, Repeat | Users replace recurring manual Excel work with reviewed local workflows |
| Horizon 2 | Private data agent | Semantic memory, richer workflow, reporting, large-data engine, and bounded skills |
| Horizon 3 | Agent data runtime | External agent packs, CLI, MCP server, SDK, Artifact protocol, and marketplace foundation |
| Horizon 4 | Team and enterprise control | Policy, identity, shared metadata, audit, private deployment, and managed delivery |

Dates are planning hypotheses, not promises. The roadmap advances when acceptance gates are satisfied, not merely when calendar time passes.

---

## Horizon 0 — Public beta closure

### 10. Objective

Turn the current productization branch into a trustworthy installable baseline that can be tested by real users without overstating planned capabilities.

### 11. P0 deliverables

#### 11.1 Branch and product truth

- Merge or otherwise establish the productization branch as the accepted baseline.
- Keep `PRODUCT_MANIFEST.yaml`, runtime, tests, screenshots, README, and release evidence aligned.
- Preserve the rule that planned and in-progress behavior is never presented as shipped.
- Remove or clearly isolate remaining legacy Wails surfaces.

#### 11.2 Signed distribution

- Produce real signed and notarized macOS arm64 and x64 packages.
- Produce a real signed Windows x64 installer.
- Verify clean-device install, launch, sidecar lifecycle, uninstall, and reinstall.
- Verify backup, restore, and migration across supported release versions.
- Publish checksums and SBOMs.
- Keep automatic updates disabled until update and rollback trust is proven.

#### 11.3 Activation-oriented onboarding

Replace an abstract empty chat with concrete starting actions:

- Clean one file.
- Compare two files.
- Reconcile two files.
- Merge multiple files.
- Analyze a business topic.
- Repeat a previous task.

Retain conversation-first execution after the task is selected.

#### 11.4 Optional privacy-preserving telemetry

The current local-only metrics contract remains the default.

Add a separate, explicit opt-in anonymous telemetry channel that may send only bounded operational metadata such as:

- application version;
- operating-system family;
- feature and event name;
- success or failure category;
- duration bucket;
- row-count and column-count buckets;
- stable anonymous installation identifier if separately consented.

It must never send:

- questions;
- prompts;
- model output;
- file or dataset names;
- absolute paths;
- column names;
- cell or row values;
- credentials;
- thread or Artifact content.

#### 11.5 Evaluation baseline

Create a versioned evaluation corpus containing synthetic and licensed fixtures for:

- import and type preservation;
- schema drift;
- query planning;
- join cardinality;
- privacy disclosure;
- workflow resume;
- cancellation and recovery;
- MCP approval drift;
- prompt injection embedded in files, metadata, and tool output.

### 12. Exit gate

Horizon 0 is complete when a new user can install a signed package on a clean supported device, import a file, complete one useful local task, inspect the disclosure and evidence, export a result, restart the application, and recover the task without developer assistance.

---

## Horizon 1 — Clean, Reconcile, Repeat

### 13. Objective

Deliver the first product users will pay for: a private local tool that replaces recurring spreadsheet cleanup and reconciliation work.

### 14. TransformationPlan

#### 14.1 Contract

Add a versioned typed `TransformationPlan` beside `QueryPlan`.

The model may propose a plan, but the data core validates:

- dataset and version references;
- source and output identities;
- columns and semantic types;
- operation allowlist;
- operation order;
- row and memory budgets;
- join cardinality and amplification;
- output naming;
- deterministic parameters;
- approval binding;
- execution fingerprint.

No model-generated Python, JavaScript, SQL, shell, or spreadsheet macro runs as the default transformation path.

#### 14.2 Initial transformation operations

Column operations:

- rename;
- drop;
- reorder;
- duplicate;
- cast;
- parse date and time;
- trim and normalize whitespace;
- upper, lower, title, and normalized case;
- exact and rule-based replace;
- regex extract;
- split and merge;
- format normalization;
- conditional and derived columns.

Row operations:

- filter;
- remove empty rows;
- deduplicate;
- fill null;
- forward and backward fill where explicitly valid;
- sort;
- sample;
- add deterministic row identifiers;
- conditional inclusion or exclusion.

Multi-table operations:

- append;
- union with explicit field mapping;
- bounded lookup join;
- inner, left, and anti join;
- difference;
- aggregate before join;
- reconciliation.

Shape operations:

- group;
- pivot;
- unpivot;
- explode bounded list values;
- normalize and denormalize approved structures.

#### 14.3 Impact preview

Before execution, show:

- affected datasets and versions;
- operations in business language;
- estimated rows read and written;
- columns added, removed, renamed, or cast;
- possible row loss;
- join cardinality assumptions;
- expected output dataset;
- whether any model or external tool is involved;
- exact disclosure preview.

### 15. Derived datasets and lineage

#### 15.1 New entities

Introduce durable entities equivalent to:

- `TransformationDefinition`;
- `TransformationVersion`;
- `TransformationRun`;
- `DerivedDataset`;
- `DerivedDatasetVersion`;
- `LineageEdge`;
- `QualityDelta`;
- `ExecutionFingerprint`.

#### 15.2 Immutability

- Source dataset versions remain immutable.
- Transformations create new derived versions.
- A rerun against a new source version creates a new run and output version.
- Users may hide, archive, or delete derived data through explicit lifecycle operations.

#### 15.3 Lineage view

Show:

- source datasets and versions;
- transformation steps;
- workflow and approvals;
- output datasets and reports;
- quality changes;
- model disclosures;
- external capabilities invoked;
- execution and output hashes where useful.

### 16. BuBu Clean

#### 16.1 First-run experience

- Import one or more files.
- Detect probable type, formatting, missing-value, duplicate, and schema issues locally.
- Present a ranked set of repairs.
- Explain each repair and its impact.
- Let the user edit the plan.
- Execute locally.
- Create a derived dataset and exportable file.
- Offer to save the task as a workflow.

#### 16.2 Initial templates

- Customer-list cleanup.
- Date and currency normalization.
- Duplicate-order cleanup.
- Empty and malformed row cleanup.
- Column-name standardization.
- Multiple monthly CSV append.

### 17. BuBu Reconcile

#### 17.1 Reconciliation contract

A reconciliation is not a generic join. It records:

- participating source versions;
- candidate and confirmed keys;
- exact and tolerance matching rules;
- duplicate handling;
- one-to-one, one-to-many, and unresolved categories;
- amount and date tolerances;
- match confidence for non-exact rules;
- unresolved reason codes;
- control totals before and after;
- evidence rows retained locally.

#### 17.2 Matching stages

1. Exact stable-key match.
2. Exact normalized composite-key match.
3. Approved tolerance match.
4. Optional approved fuzzy candidate generation.
5. Human review for unresolved candidates.
6. Completion verification.

Fuzzy matching must never silently convert an uncertain candidate into a confirmed financial match.

#### 17.3 Reconciliation artifacts

- Summary counts and amounts.
- Matched records.
- Unmatched left and right records.
- Duplicates.
- Conflicts.
- Tolerance matches.
- Unresolved candidates.
- Control-total checks.
- Lineage and execution evidence.

#### 17.4 Initial templates

- Sales and refunds.
- Orders and payments.
- Bank statement and ledger.
- Invoices and payments.
- Inventory and sales movements.
- Customer-list comparison.

### 18. BuBu Compare

- Compare dataset versions.
- Compare independently imported files.
- Identify schema, row, and aggregate changes.
- Support explicit matching keys.
- Produce added, removed, changed, and duplicate views.
- Generate a bounded difference Artifact and export.
- Save comparison rules for the next version.

### 19. BuBu Repeat

#### 19.1 Recognition

When a new file or version arrives, BuBu should:

- find workflows previously used with the same data object or schema family;
- compare schemas and profiles;
- identify drift;
- recommend the safest reusable workflow;
- explain required remapping or user decisions.

#### 19.2 Execution

- Rebind the workflow to the new version only through a typed reviewed operation.
- Revalidate all relationships, rules, and budgets.
- Execute with idempotency and checkpoints.
- Verify output completeness.
- create a new Artifact and derived dataset version.
- retain previous outputs and evidence.

#### 19.3 Triggers

- Manual.
- Dataset-version arrival.
- Folder watch.
- Daily, weekly, monthly, and business cadence.
- External approved invocation.

### 20. Reporting and delivery V1

Add deterministic, evidence-first report bundles:

- summary;
- key metrics;
- tables;
- supported charts;
- validation and quality section;
- exceptions;
- limitations;
- lineage and run metadata;
- optional model-generated narrative clearly separated from deterministic facts.

Initial exports:

- HTML;
- PDF;
- CSV;
- XLSX with multiple sheets;
- PNG or SVG chart images;
- JSON manifest for machine consumption.

### 21. Strict Private Mode and local DLP

Add a non-bypassable user-selectable mode:

- no remote explicit-row disclosure;
- no remote MCP;
- no automatic external process invocation;
- only schema, synthetic, and approved aggregate context may reach remote models;
- tasks requiring row semantics route to deterministic code or an approved local model;
- clipboard and prompt text are scanned for likely pasted rows, PII, credentials, and secrets;
- the UI explains why a request was blocked or rerouted.

### 22. Horizon 1 exit gate

Horizon 1 is complete when representative users can replace at least three recurring manual spreadsheet processes with reviewed workflows, rerun them against new versions, recover from schema drift, export professional results, and verify that raw rows remained local by default.

---

## Horizon 2 — Private data agent

### 23. Objective

Turn the successful local workflow product into a context-aware private data agent without weakening deterministic authority.

### 24. Analytical engine abstraction

#### 24.1 Responsibilities

Keep SQLite as the control and product database for:

- catalog;
- conversations;
- tasks;
- workflows;
- approvals;
- policy;
- audit;
- metadata;
- small and bounded analytical work.

Introduce a versioned `AnalyticalEngine` port for:

- large scans;
- multi-file queries;
- complex joins;
- window functions;
- pivot and unpivot;
- Parquet and Arrow;
- larger transformations;
- spill-to-disk execution.

#### 24.2 Adapters

- Existing SQLite adapter.
- DuckDB adapter after contract and benchmark validation.

The product must not perform a rewrite merely to adopt a fashionable engine. Engine selection should remain an internal policy based on operation, format, size, memory, and performance evidence.

#### 24.3 Large File Mode

Target capabilities:

- multi-gigabyte CSV where hardware allows;
- Parquet import and export;
- folder-level scans;
- chunked and partitioned export;
- bounded memory;
- cancellation and checkpointing;
- progress that reflects actual execution state.

### 25. Expanded analysis plans

Add typed analytical operations after the transformation foundation is stable:

- rank;
- running total;
- moving average;
- period-over-period change;
- percent of total;
- median and percentile;
- standard deviation;
- cohort;
- funnel;
- segmentation;
- Pareto analysis;
- correlation with warnings;
- anomaly candidates;
- bounded forecast and statistical tests with explicit assumptions.

Statistical and predictive outputs must include assumptions, sample size, limitations, and deterministic source references.

### 26. Local semantic layer

#### 26.1 Semantic entities

- Dataset and business-topic descriptions.
- Column descriptions and semantic types.
- Metric definitions.
- Relationships.
- Validation rules.
- Transformation definitions.
- Workflow definitions.
- Report templates.
- User-confirmed aliases and mappings.

#### 26.2 Schema memory

BuBu should remember user-confirmed corrections such as:

- a field represents customer ID;
- a field is gross or net revenue;
- a date uses a specific locale;
- a table is a fact or lookup table;
- a relationship requires a composite key;
- a value must preserve leading zeros.

Memory must be:

- local by default;
- visible;
- editable;
- versioned where behavior changes;
- scoped to a dataset, schema family, workspace, or organization;
- never inferred into permanent truth without confirmation.

### 27. Local RAG

Local RAG should initially index metadata and durable knowledge, not raw rows by default:

- schema and profiles;
- glossary;
- metrics;
- relationships;
- rules;
- transformations;
- workflows;
- report templates;
- prior error resolutions;
- product and customer-provided operating procedures.

Suggested architecture:

- SQLite FTS for exact and lexical retrieval;
- local vector index for semantic retrieval;
- metadata filters;
- optional local embeddings and reranker;
- explicit context builder and budget;
- citations back to local objects and versions.

### 28. Agent Harness

#### 28.1 Runtime entities

Generalize the bounded aggregate agent into explicit entities:

- `TaskSpec`;
- `Plan`;
- `Step`;
- `Capability`;
- `Observation`;
- `Artifact`;
- `Verification`;
- `Approval`;
- `Checkpoint`;
- `Budget`;
- `StopReason`.

#### 28.2 Loop

`understand → retrieve context → propose plan → policy check → execute one bounded step → validate observation → checkpoint → continue, replan, request approval, or stop`

#### 28.3 Budgets

Every agent run binds:

- maximum model turns;
- maximum tool calls;
- maximum elapsed time;
- maximum model tokens and managed-model cost;
- maximum rows or cells disclosed;
- allowed capabilities;
- allowed side-effect level;
- required verification;
- cancellation and recovery policy.

#### 28.4 Planner, executor, evaluator

Use separate roles only for tasks that justify them:

- Planner produces a typed DAG or ordered plan.
- Deterministic executor performs supported operations.
- Evaluator checks explicit criteria such as totals, uniqueness, row loss, relationship cardinality, and report completeness.

Do not multiply agents where a deterministic rule or single bounded planner is sufficient.

### 29. Capability Registry

Unify native operations, models, local skills, MCP tools, connectors, and future agents under a common registry.

Each capability records:

- identifier and version;
- origin;
- description;
- input and output schema;
- trust level;
- side-effect category;
- data and disclosure scope;
- approval policy;
- timeout;
- retry and idempotency policy;
- cost class;
- local or remote execution;
- health and availability;
- evaluation coverage.

The model receives only a dynamically selected subset relevant to the current task.

### 30. Workflow V2

Expand workflow nodes:

#### Data nodes

- source;
- transform;
- validate;
- query;
- join;
- reconcile;
- compare;
- derive;

#### Control nodes

- condition;
- branch;
- retry;
- wait;
- approval;
- human input;
- checkpoint;

#### Intelligence nodes

- bounded planner;
- classifier;
- extraction;
- explanation;
- evaluator;

#### Delivery nodes

- chart;
- report;
- export;
- local notification;
- email or approved external delivery;

#### Integration nodes

- MCP resource read;
- approved MCP tool call;
- connector read;
- approved external write.

### 31. Reports and visualization V2

- Multi-chart report canvas without becoming a free-form BI designer.
- KPI cards.
- Filter controls over bounded Artifact data.
- Comparison and variance reports.
- Branded templates.
- Scheduled reports.
- Evidence appendix.
- Data tables as accessible alternatives.
- Deterministic chart grammar and recommendation.

Additional supported charts may include line, area, stacked bar, scatter, histogram, box plot, heatmap, waterfall, funnel, cohort, Pareto, treemap, and calendar heatmap where the data semantics justify them.

### 32. Cost router

Before using a model, decide whether a task can be completed by:

1. deterministic local code;
2. local retrieval and rules;
3. a local model;
4. a low-cost remote planning model;
5. a stronger remote model.

Show the user:

- selected model;
- whether raw rows leave the device;
- estimated managed-model cost where applicable;
- token or budget ceiling;
- reason for escalation.

### 33. Horizon 2 exit gate

Horizon 2 is complete when BuBu can understand a returning user's business vocabulary, select a bounded set of capabilities, plan and execute multi-step data work, verify the result, produce a professional Artifact, and explain every disclosure and operation without relying on arbitrary code execution.

---

## Horizon 3 — Agent data runtime and ecosystem

### 34. Objective

Make BuBu callable from the AI tools users already use while preserving local authority and creating distribution leverage.

### 35. BuBu as MCP server

#### 35.1 Safe tools

Candidate tools:

- `list_datasets`;
- `get_dataset_schema`;
- `get_dataset_profile`;
- `find_business_topics`;
- `propose_query`;
- `propose_transformation`;
- `prepare_reconciliation`;
- `get_plan_review`;
- `run_approved_plan`;
- `run_approved_workflow`;
- `get_artifact_summary`;
- `get_quality_report`;
- `open_approval`;
- `open_artifact`.

#### 35.2 Tools not exposed by default

- arbitrary SQL;
- arbitrary file read;
- all-row extraction;
- shell execution;
- unrestricted network access;
- implicit approval;
- generic external write.

#### 35.3 Artifact handles

External agents should normally receive a summary and local handle rather than full private data:

```json
{
  "artifactId": "artifact_123",
  "type": "reconciliation-report",
  "summary": "37 amount differences require review",
  "evidenceCount": 37,
  "localUri": "bubu://artifacts/artifact_123",
  "rawRowsDisclosed": false
}
```

### 36. CLI and SDK

Candidate CLI commands:

```text
bubu dataset import <file>
bubu dataset inspect <id>
bubu dataset compare <left> <right>
bubu plan validate <plan.json>
bubu workflow run <workflow-id>
bubu artifact export <artifact-id>
bubu eval run <suite>
```

The CLI must use the same contracts, policy, approvals, and data core as the desktop application.

The SDK should expose typed local APIs without creating a second authority path.

### 37. Deep links

Candidate local links:

- `bubu://import`;
- `bubu://tasks/new`;
- `bubu://plans/{id}`;
- `bubu://approvals/{id}`;
- `bubu://workflows/run/{id}`;
- `bubu://artifacts/{id}`.

Deep links should focus the exact local review or result rather than granting authority.

### 38. External agent packs

Produce integration packs for:

- WorkBuddy;
- TRAE Work;
- Codex;
- Claude Code;
- Gemini CLI;
- GitHub Copilot;
- generic MCP-compatible hosts.

Each pack may include:

- MCP configuration;
- skill instructions;
- CLI commands;
- task templates;
- tool restrictions;
- evaluation fixtures;
- privacy and approval guidance.

### 39. Pack format

Explore a canonical `bubu-pack.yaml` that compiles into host-specific formats:

```yaml
name: monthly-sales-reconciliation
version: 1.0.0

supports:
  - bubu
  - workbuddy
  - trae
  - codex
  - claude-code
  - gemini-cli
  - github-copilot

capabilities:
  - import
  - transform
  - reconcile
  - report

privacy:
  maximumDisclosure: aggregates

evals:
  - fixtures/sales-refunds
```

The canonical format must not claim platform compatibility until a tested adapter exists.

### 40. Skill system

A Skill packages:

- purpose and activation criteria;
- required input contracts;
- plan templates;
- allowed capabilities;
- disclosure policy;
- validation and completion criteria;
- recovery guidance;
- evaluation fixtures;
- version and compatibility.

Initial skills:

- Data Cleaning.
- Monthly Reconciliation.
- Schema Mapping.
- Data Quality.
- Executive Report.
- Sales Analysis.
- Inventory Exceptions.
- Customer Deduplication.

### 41. Marketplace foundation

Only launch a marketplace after packs can be installed, verified, permission-reviewed, versioned, and removed safely.

Possible assets:

- workflows;
- skills;
- transformations;
- connectors;
- report templates;
- industry packs;
- evaluation fixtures.

Marketplace items must include:

- declared permissions;
- maximum disclosure;
- external endpoints;
- side effects;
- version compatibility;
- test evidence;
- publisher identity;
- update policy.

### 42. MCP host evolution

For BuBu consuming external MCP capabilities:

- keep manual discovery separate from execution;
- normalize tools into the Capability Registry;
- classify trust and side effects;
- require exact schema and parameter review for sensitive calls;
- add process sandboxing, restricted users, file roots, and network allowlists;
- treat prompts and tool results as untrusted data;
- make model-driven calls policy-bound and observable;
- keep low-level MCP inspection in advanced or developer mode.

### 43. Horizon 3 exit gate

Horizon 3 is complete when a supported external agent can discover a narrowly scoped BuBu capability, propose a local task, send the user to a precise approval, receive a bounded Artifact handle, and continue its larger workflow without receiving unauthorized raw rows or bypassing BuBu policy.

---

## Horizon 4 — Team and enterprise control

### 44. Objective

Support organizations that need shared workflows, managed policy, audit, and private deployment while preserving the local-first architecture.

### 45. BuBu Hub

Potential services:

- organization and user management;
- device enrollment and health;
- policy version distribution;
- approved provider and model catalogs;
- approved MCP and connector catalogs;
- workflow and template metadata sharing;
- audit aggregation without raw product content by default;
- entitlement and billing;
- optional encrypted metadata or snapshot synchronization.

### 46. Identity and policy

- SSO and SCIM.
- RBAC and ABAC.
- Dataset, workflow, capability, and disclosure policies.
- Required approval levels.
- Allowed local and remote models.
- Data residency.
- Retention and deletion.
- Export policy.
- Device trust.

### 47. Enterprise data paths

Possible deployment modes:

- standalone local desktop;
- desktop plus enterprise model gateway;
- desktop plus private Hub;
- private network deployment;
- managed virtual desktop;
- approved server-side execution for explicitly migrated workloads.

The local desktop path remains supported and independently useful.

### 48. Enterprise integrations

Prioritize business-result connectors rather than building a generic connector catalog first:

- finance and ERP exports;
- ecommerce platforms;
- advertising platforms;
- cloud storage;
- data warehouses and databases;
- ticketing and collaboration tools;
- enterprise MCP gateways.

### 49. Managed workflow delivery

Offer a services-assisted product for customers who need outcomes rather than configuration:

- workflow discovery;
- schema and rule setup;
- connector implementation;
- evaluation and acceptance;
- monthly maintenance;
- schema-drift handling;
- ROI reporting.

### 50. Horizon 4 exit gate

Horizon 4 is complete when an organization can centrally approve models, capabilities, disclosure levels, workflows, and devices; share reusable metadata and templates; audit execution; and operate BuBu without centralizing raw data by default.

---

### 51. Function backlog by domain

This section is a product inventory, not a commitment to build every item.

#### 51.1 Import and sources

- CSV, TSV, XLSX.
- Parquet.
- JSON and JSON Lines.
- SQLite and DuckDB files.
- Clipboard paste.
- Folder watch.
- Compressed archive import.
- Email-attachment inbox.
- Cloud-drive manual import.
- PDF table extraction.
- Image table OCR.
- Read-only database connections.
- Paginated API import.
- MCP resource import.

#### 51.2 Profiling and semantic detection

- Type inference.
- Null and distinct counts.
- Unique-key candidates.
- Foreign-key candidates.
- Date and text-length distributions.
- Pattern and regular-expression discovery.
- Currency and unit detection.
- Identifier detection.
- PII and secret classification.
- Outlier candidates.
- Drift detection.

#### 51.3 Data quality

- Required.
- Unique.
- Range.
- Regex.
- Allowed values.
- Date range.
- Cross-field conditions.
- Cross-table consistency.
- Foreign-key integrity.
- Control totals.
- Join cardinality.
- Custom deterministic formulas.
- Rule templates.
- Quality trends.
- Repair recommendations.

#### 51.4 Relationships

- Relationship graph.
- Composite keys.
- Confidence and confirmation state.
- Time-aware relationships.
- Normalized-string relationships.
- Fuzzy candidate relationships.
- Entity resolution.
- Union groups.
- Cross-topic references.

#### 51.5 Query and analysis

- Dimensions and metrics.
- Filters and sorting.
- Grouping and aggregation.
- Window functions.
- Ranking.
- Period comparison.
- Percent of total.
- Cohort and funnel.
- Pareto.
- Anomaly candidates.
- Forecast and statistical tests with evidence.

#### 51.6 Transformation

- Rename, cast, trim, replace.
- Split, merge, parse.
- Deduplicate and fill.
- Conditional columns.
- Join, anti join, union, append.
- Pivot and unpivot.
- Normalize and denormalize.
- Reconciliation.

#### 51.7 Conversations and tasks

- Tags.
- Search.
- Favorites.
- Task templates.
- Thread fork and comparison.
- Prompt variables.
- Command palette.
- Cross-object references.
- Recent and unfinished task inbox.

#### 51.8 Artifacts and reports

- Tables.
- Derived datasets.
- Charts.
- KPI cards.
- Narrative sections.
- Evidence timeline.
- Lineage.
- Quality report.
- HTML, PDF, XLSX, CSV, image, and JSON exports.
- Scheduled delivery.

#### 51.9 Workflow

- Data, control, intelligence, delivery, and integration nodes.
- Manual and triggered execution.
- Retry, idempotency, checkpoint, cancellation, and recovery.
- Human approval and input.
- Completion verification.
- Version comparison.

#### 51.10 Models

- OpenAI.
- Anthropic.
- Gemini.
- OpenAI-compatible.
- Ollama and local providers.
- Enterprise gateway.
- Task, privacy, cost, and capability routing.
- Fallback and health.
- Embedding and reranking providers.
- Vision providers for supported import tasks.

#### 51.11 Security and privacy

- Strict Private Mode.
- Prompt DLP.
- PII and secret scanning.
- Exact disclosure review.
- One-use approvals.
- Process sandboxing.
- File and network restrictions.
- Signed policy.
- Encrypted debug trace.
- Retention controls.
- Tamper-evident evidence.
- Audit export.

#### 51.12 Backup and portability

- Automatic encrypted backup.
- User-selected location.
- Retention policy.
- Selective restore.
- Device migration.
- Portable workspace.
- Workflow-only export.
- Enterprise recovery policy.

---

### 52. Privacy and disclosure roadmap

Disclosure levels remain explicit and ordered:

1. Local deterministic execution only.
2. Schema only.
3. Schema plus fully synthetic examples.
4. Approved bounded aggregates.
5. Redacted or tokenized bounded values where a dedicated contract exists.
6. Explicit rows only in a separately reviewed high-risk mode.

Rules:

- A prompt, provider response, workflow, skill, MCP server, or external agent cannot raise its own level.
- The data core enforces the final level.
- Approval is bound to exact content, policy, provider, tool, schema, version, and budget.
- Higher-risk disclosure should have an expiration and a visible reason.
- Strict Private Mode caps the maximum level.

---

### 53. Evidence-first completion

A workflow is not complete merely because no exception occurred.

Completion criteria may include:

- expected source versions were used;
- row counts reconcile;
- totals balance;
- uniqueness and relationship assumptions hold;
- output was created atomically;
- delivery succeeded or has a known recoverable state;
- output hashes and lineage were recorded;
- unresolved exceptions are visible;
- user-required approval was obtained.

A reconciliation Artifact, for example, should state:

- input rows;
- matched rows;
- unmatched rows by side;
- duplicates;
- conflicts;
- amount difference;
- control-total result;
- output and evidence identifiers.

---

### 54. Evaluation strategy

#### 54.1 Evaluation layers

- Intent classification.
- Context retrieval.
- Plan generation.
- Plan validation.
- Deterministic execution.
- Tool and capability selection.
- Workflow recovery.
- Artifact completeness.
- Privacy and adversarial behavior.
- User correction and learning.

#### 54.2 Domain suites

- Sales and refund reconciliation.
- Bank and ledger reconciliation.
- Customer deduplication.
- Multi-file append and schema drift.
- Inventory exceptions.
- Marketing report generation.
- Financial control totals.

#### 54.3 Adversarial suites

- Prompt injection in cell values.
- Prompt injection in headers and sheet names.
- Malicious MCP descriptions and outputs.
- Schema drift after approval.
- Approval replay.
- Cancellation during an external side effect.
- Cross-thread and cross-dataset leakage.
- CSV and spreadsheet formula injection.
- Oversized result and token-exhaustion attempts.

#### 54.4 Release rule

No autonomous or external capability graduates from experimental status without:

- typed contract;
- policy model;
- unit and integration tests;
- evaluation suite;
- cancellation and recovery behavior;
- disclosure and audit coverage;
- product documentation;
- executable verification.

---

### 55. Commercial packaging hypotheses

Prices are hypotheses to test, not commitments.

#### 55.1 Free Local

Goal: let a user complete a full first task.

Possible scope:

- CSV and XLSX import.
- Local profiling and quality.
- Clean Lite.
- Compare.
- Basic query and charts.
- Three saved workflows.
- Local models and bring-your-own model.
- Basic local MCP server capabilities.

Do not reduce the free product to a small message allowance.

#### 55.2 Local License

Possible price test: **USD 79–99 one time**, including a defined update period.

Possible scope:

- full local transformations;
- derived datasets;
- local reports;
- basic lineage;
- manual workflows;
- BYOM.

This tier addresses subscription fatigue and supports a durable desktop-product identity.

#### 55.3 Personal Pro

Possible price test: **USD 15 per month or USD 120 per year**.

Possible scope:

- unlimited local data objects;
- full transformations and reconciliation;
- automatic workflows;
- folder watch;
- scheduled reports;
- semantic layer and local RAG;
- advanced reports;
- external-agent integrations;
- complete privacy ledger.

#### 55.4 Builder

Possible price test: **USD 29–39 per month**.

Possible scope:

- Studio;
- CLI and SDK;
- MCP server and advanced host tools;
- pack and skill authoring;
- evaluation runner;
- DuckDB and Parquet;
- advanced trace;
- connector development.

#### 55.5 Team

Possible price test: **workspace base fee plus per-user fee**.

Possible scope:

- shared workflows and templates;
- shared semantic metadata;
- administrator policy;
- team audit;
- approved providers and capabilities;
- optional metadata synchronization.

#### 55.6 Business packs

Possible price range: **USD 99–299 per month** depending on automation and service level.

Examples:

- Finance Reconciliation.
- Ecommerce Operations.
- Agency Reporting.
- App Revenue Reporting.
- Consultant Workspace.

#### 55.7 Enterprise

Possible annual contract range: **USD 20,000–100,000+**, depending on deployment, connectors, policy, and services.

#### 55.8 Managed AI

- BYOM and local-model use should not incur a BuBu token tax.
- Managed models may be billed transparently at actual cost plus a disclosed service margin.
- The UI should show expected and actual usage.
- Core subscription value remains software capability, not token resale.

---

### 56. Distribution roadmap

#### 56.1 Search and problem pages

Build pages around concrete jobs:

- merge multiple CSV files;
- compare two Excel files;
- reconcile orders and refunds;
- remove duplicates from a large CSV;
- analyze Excel locally with AI;
- automate monthly Excel reports;
- use AI without uploading spreadsheet rows;
- recover from spreadsheet schema drift;
- replace fragile Power Query reconciliation.

#### 56.2 Templates

Templates are a primary acquisition and activation surface, not an optional gallery.

Initial template families:

- finance;
- ecommerce;
- marketing;
- inventory and supply chain;
- HR administration;
- consulting;
- investment research.

#### 56.3 Community launch strategy

Useful technical launches are stronger than broad product announcements:

- a local-first million-row reconciliation benchmark;
- a spreadsheet AI that does not execute model SQL;
- an MCP server for processing private spreadsheets locally;
- an open reconciliation fixture and evaluation suite;
- a free spreadsheet privacy scanner.

#### 56.4 Consultant and partner channel

Support consultants, accountants, agencies, and implementation partners who can create reusable local workflows for clients while keeping client data on client devices.

Possible partner capabilities:

- branded reports;
- reusable packs;
- client workspace provisioning;
- workflow export and import;
- managed updates;
- partner licensing.

---

### 57. Twelve-week execution sequence

This is the recommended first delivery sequence after the current productization baseline is accepted.

#### Weeks 1–2: release and measurement

- Establish accepted branch and version.
- Produce real signed packages.
- Run clean-device acceptance.
- Add concrete task onboarding.
- Add opt-in anonymous operational telemetry.
- Establish evaluation fixtures and seed-user program.

#### Weeks 3–6: BuBu Clean

- TransformationPlan V1.
- Derived datasets.
- Impact preview.
- Lineage V1.
- Core clean operations.
- CSV and XLSX export.
- Five cleaning templates.

#### Weeks 7–9: BuBu Reconcile

- Exact and composite matching.
- Join and anti join.
- Duplicate detection.
- Amount and date tolerance.
- Unmatched and conflict views.
- Control totals.
- Evidence-first report.

#### Weeks 10–12: BuBu Repeat

- Folder watch.
- Workflow recognition.
- Schema-drift recommendation.
- Reviewed rebinding.
- Automatic rerun.
- Scheduled Artifact.
- Local notification.
- Twenty complete workflow templates across three industries.

At the end of twelve weeks, do not advance automatically. Review activation, repeat use, task success, privacy incidents, performance, and willingness to pay.

---

### 58. Explicit non-goals

The following are not priorities until the core product demonstrates retention:

- arbitrary SQL or shell execution;
- unrestricted browser or desktop control;
- general-purpose coding agent;
- multi-agent debate or swarm;
- broad A2A network;
- generic knowledge chatbot;
- real-time collaborative cell editing;
- complete online spreadsheet replacement;
- full BI dashboard parity;
- general WYSIWYG report editor;
- cloud raw-row sync by default;
- automatic MCP registration and execution;
- remote MCP and OAuth breadth before local tasks are strong;
- mandatory Hub account for local mode.

---

### 59. Roadmap governance

#### 59.1 Sources of truth

- `PRODUCT_MANIFEST.yaml` — capability status.
- Runtime and tests — actual behavior.
- Verifiers — repository and release contracts.
- Product documentation — user-facing current behavior.
- This roadmap — direction and sequencing only.

#### 59.2 Status discipline

Every roadmap item should eventually be represented as one of:

- research;
- accepted design;
- implementation plan;
- in progress;
- implemented;
- verified;
- released;
- deprecated;
- rejected.

`implemented` is not equivalent to `released`.

#### 59.3 Change discipline

A major roadmap change should state:

- user or market evidence;
- affected principle;
- new priority and displaced work;
- architecture impact;
- privacy and security impact;
- evaluation and release implications.

---

### 60. Definition of winning

BuBu wins neither by having the most models nor by exposing the most tools.

BuBu wins when:

- a non-technical user can replace a recurring spreadsheet task without learning SQL or agent architecture;
- a professional user can inspect, edit, verify, and repeat every material step;
- a privacy-sensitive user can prove what did and did not leave the device;
- a consultant can package a successful workflow for multiple clients;
- an external AI agent can call BuBu without gaining unrestricted access to private rows;
- a business can adopt stronger models without rebuilding its data workflows;
- the user's accumulated schema memory, rules, transformations, evidence, and workflow history become more valuable over time.

The intended product loop is:

`files → data objects → business topics → task conversations → typed plans → local execution → derived data and Artifacts → workflows → new versions → verified repetition`

The intended ecosystem loop is:

`external agent → BuBu capability discovery → local policy and approval → deterministic execution → Artifact handle → larger agent workflow`

The final product statement is:

> **Your agents think. BuBu handles the data.**

And the immediate operating rule remains:

> **Do not add broader autonomy before the deterministic data capabilities are strong enough to deserve it.**
