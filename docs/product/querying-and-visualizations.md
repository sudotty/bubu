# Querying data and local visualizations

Status: Single-object and bounded business-topic lookup queries, local conversation history, reusable relationship definitions, derived data objects, deterministic multi-metric chart composition, and configurable professional report composition are implemented.

## Ask one data object

1. Configure and test a model in **模型设置**.
2. Open a data object and enter a question in **数据对话**.
3. BuBu first performs non-bypassable local DLP on the question and selected template. In local-private mode it sends the allowed question plus column structure and three generated examples; strict-private mode sends only column structure to remote providers. Neither mode sends preview rows, file names, source paths, minima, maxima, or profile values.
4. Review the proposed dimensions, calculations, filters, row limit, and the exact disclosure envelope.
5. Select **批准并在本地执行**. Go validates the immutable version and compiles the typed plan into one bounded local `SELECT`.

The model cannot submit SQL, formulas, output HTML, or arbitrary functions. A plan can return at most 200 rows.

## Ask a business topic

Create a business topic with 2–8 data objects. The order shown above the composer is the source order used by the model. A topic question can perform an inner or left equality lookup. Every table after the first must join to an already connected table, and every right-side key must be locally profiled as non-null and unique.

This is intentionally a lookup-safe subset. If a right-side key is duplicated, reverse the fact/lookup order when appropriate, fix the reference table, or wait for a future explicitly budgeted one-to-many relationship feature. BuBu rejects a many-to-many join instead of risking explosive local work or misleading totals.

Member display names stay in the UI. The model sees numbered source contexts, exact column names/types/nullability/uniqueness, and generated examples. Review the complete join tree and disclosure details before selecting **批准并在本地关联**.

## Charts

After a successful query, BuBu locally derives a chart when the result contains a numeric series and another usable category column:

- a datetime category becomes a line chart;
- another category becomes a bar chart;
- non-numeric or empty results remain a table only.

Charts require at most 20 complete result rows; larger or repeated-dimension results stay as a table instead of being silently truncated or aggregated. When one unique dimension is paired with several numeric outputs, BuBu composes up to four metric views and renders one quiet chart at a time with an accessible metric switcher. Every view has its own data-table alternative. The selected metric is remembered locally for the same bounded output schema; at most 24 preferences are retained, and no row or cell values are stored. The full bounded result remains visible in the data tab. Chart derivation is deterministic React/SVG code; query results are not sent to a model and no model-generated HTML or JavaScript is rendered.

Questions, reviewed plans, local results, and failures are appended to the target's private local thread. Reopening the data object or business topic restores the typed timeline and locally regenerates charts. The renderer can read this history but cannot forge or append entries through preload.

## Analysis and output templates

Use **Settings → 分析与输出** to choose or create bounded templates for single-object planning, business-topic planning, and approved aggregate explanations. Planning templates influence field and aggregation preferences without adding SQL or authority. Output templates such as **证据优先** and **管理层简报** influence only how approved aggregate cells are explained. The selected output template appears in the exact disclosure preview and is locked into the one-use approval session, so changing settings after approval cannot change the model request.

## Save a result as a derived data object

After a reviewed plan runs, open **数据与结果 → 摘要 → 保存为数据对象**. Name the output and confirm the action. BuBu reruns the exact typed plan in Go and creates a normal data object with source kind `derived`; it never sends result rows back through the renderer for persistence and never accepts SQL, formulas, JavaScript, Python, or shell code.

Each derived version stores:

- the immutable dataset/version identity of every parent;
- the dataset-query or group-query plan kind and user-visible purpose;
- a SHA-256 plan fingerprint and the bounded typed plan used to materialize it;
- the output schema, profiles, row count, and ordinary immutable version metadata.

The new object can be previewed, queried, validated, related, placed in a business topic, or materialized again. This makes `A/B/C → X → Y` an ordinary object chain instead of a hidden chat-only export. Its data inspector shows the lineage and provides **用当前上游版本重算**, which rebinds the same reviewed plan to current parent versions and creates a new immutable output version. If business-topic membership or order changed, BuBu rejects manual recompute and requires a newly reviewed plan. When a current source version activates, the Go data core also enqueues every active dependent derived object exactly once, advances compatible chains in topological order without a model call, and pauses the affected branch on schema drift or blocking quality.

## Data-clean kernel status

The process-boundary contract and Go data core now implement a bounded typed cleanup grammar: select/reorder, rename, cast, replace, derive, filter, deduplicate, fill missing values, append an identical schema, and union through an explicit mapping. Execution is local, version-bound, cancellable, resource-bounded, lineage-preserving, and atomic. Invalid casts configured as `reject`, stale versions, unknown columns, incompatible appends, and malformed mappings fail without creating a partial data object.

Use **清理数据** in a data object's header to create a reviewed local cleanup. The first visible builder supports selecting/reordering columns and optional keyed deduplication. **预览影响** performs the complete transformation in memory without writing and shows the immutable source version, destination name, exact ordered operations, before/after rows and columns, affected-row counts, and plan fingerprint. Closing or editing cancels the pending review; **批准并创建数据对象** consumes a ten-minute approval once and atomically creates the derived object with lineage. A stale source version, changed request, reused approval, or direct unreviewed Data Clean call fails closed.

The visible builder exposes five editable local templates: monthly preparation, customer-key deduplication, order-field normalization, identical-schema append, and reference-data coverage. Together they exercise the complete bounded cleanup grammar while retaining explicit source selection, impact preview, quality policy, one-use approval, and immutable output. The builder attaches a mandatory non-empty-output gate and supports critical-column completeness, accepted-value, deduplication-key, accepted-type, relationship-coverage, and aggregate-variance checks. Compatible source-version changes automatically replay the stored plan and policy; paused work remains visible with bounded retry or cancellation.

After creation, open **数据与结果 → 数据上下文 → 派生关系**. A Clean version shows its durable execution identifier, review origin, input/output shape, operation impacts, source versions, plan fingerprint, policy fingerprint, and every quality result. Blocking checks disable approval in the reviewed preview and are independently enforced again by Go before activation; warning checks remain visible on the activated version. This evidence belongs to the immutable version and survives backup/restore. Historical versions created before P1.4 remain explicitly marked as not configured.

## Compare and Reconcile

Compare/Reconcile is executable from an empty workspace or any saved business topic with at least two data objects. It does not ask a model to calculate matches. The user selects immutable left/right versions, exact or composite keys, bounded normalization, cardinality, reviewed amount/date tolerance, and control totals. Go validates candidate budgets and computes matched, tolerance-matched, left/right unmatched, duplicate, conflict, and pending classifications locally.

The preview is read-only. Approval is one-use and binds the complete plan fingerprint and source versions. Execution repeats the calculation and atomically persists a versioned Reconcile Artifact; cancellation, a stale version, a changed fingerprint, invalid numeric controls, or any execution error writes no partial Artifact. The packaged sales/refunds and orders/payments cases prove tolerance differences, unmatched rows, duplicate keys, pending review, and unbalanced controls. Arbitrary SQL/code, fuzzy matching, implicit many-to-many, and automatic confirmation of uncertain financial matches remain forbidden.

After inspecting an Artifact, select **保存为受审下期任务** to reuse that exact rule on later source versions. A compatible replacement creates one durable replay event and one new linked Artifact without a model call. Schema changes, increased duplicate or pending candidates, a worse control-total difference, or a lower local quality score pause the event for review. The business topic lists immutable historical Artifacts and offers reason-specific retry/cancel controls; a privacy-safe workspace entry surfaces outstanding reconciliation work without showing names, row values, or control totals in system notifications. Replay state and evidence linkage survive backup/restore and interrupted runs are recovered with at most three attempts.

## Current limits

- One query has at most 8 dimensions, 8 measures, 20 filters, 3 sorts, and 200 result rows.
- A group has at most 8 members and 7 joins.
- Supported measures are count, sum, average, minimum, and maximum.
- Explicit-row disclosure is implemented through a separate one-use review that binds exact rows, columns, purpose and destination. Archived-task deletion and an optional bounded retention policy are implemented; active or workflow-referenced tasks fail closed. Bounded chart preferences, deterministic multi-metric visual composition, reusable bounded Agent definitions, local result exports, configurable professional HTML/PDF/XLSX/CSV/manifest bundles, cancellation, aggregate explanations, bounded Agents, and usage/audit history are implemented.
- Derived objects materialize safe dataset/group query plans and the reviewed bounded Data Clean grammar. Compare/Reconcile produces its own immutable evidence Artifact. Arbitrary spreadsheet formulas, free-form SQL/code execution, write-back, and transformations outside these typed grammars remain unavailable.
