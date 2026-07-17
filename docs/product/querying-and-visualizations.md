# Querying data and local visualizations

Status: Single-dataset and bounded group lookup queries, local conversation history, and baseline charts are implemented. Reusable relationship definitions, richer chart families, and reports remain in progress.

## Ask one data contact

1. Configure and test a model in **模型设置**.
2. Open a data contact and enter a question in **和数据对话**.
3. BuBu sends the question plus column structure and three generated examples. It does not send preview rows, file names, source paths, minima, maxima, or profile values.
4. Review the proposed dimensions, calculations, filters, row limit, and the exact disclosure envelope.
5. Select **批准并在本地执行**. Go validates the immutable version and compiles the typed plan into one bounded local `SELECT`.

The model cannot submit SQL, formulas, output HTML, or arbitrary functions. A plan can return at most 200 rows.

## Ask a data group

Create a group with 2–8 data contacts. The order shown above the composer is the source order used by the model. A group question can perform an inner or left equality lookup. Every table after the first must join to an already connected table, and every right-side key must be locally profiled as non-null and unique.

This is intentionally a lookup-safe subset. If a right-side key is duplicated, reverse the fact/lookup order when appropriate, fix the reference table, or wait for a future explicitly budgeted one-to-many relationship feature. BuBu rejects a many-to-many join instead of risking explosive local work or misleading totals.

Member display names stay in the UI. The model sees numbered source contexts, exact column names/types/nullability/uniqueness, and generated examples. Review the complete join tree and disclosure details before selecting **批准并在本地关联**.

## Charts

After a successful query, BuBu locally derives a chart when the result contains a numeric series and another usable category column:

- a datetime category becomes a line chart;
- another category becomes a bar chart;
- non-numeric or empty results remain a table only.

Charts use the first 20 valid result points and report how many additional points were omitted for readability. The full bounded result remains visible in the table. Chart derivation is deterministic React/SVG code; query results are not sent to a model and no model-generated HTML or JavaScript is rendered.

Questions, reviewed plans, local results, and failures are appended to the target's private local thread. Reopening the contact or group restores the typed timeline and locally regenerates charts. The renderer can read this history but cannot forge or append entries through preload.

## Current limits

- One query has at most 8 dimensions, 8 measures, 20 filters, 3 sorts, and 200 result rows.
- A group has at most 8 members and 7 joins.
- Supported measures are count, sum, average, minimum, and maximum.
- Query result explanations, reports, exports, saved chart preferences, cancellation, retention controls, and usage/audit history are not yet complete.
