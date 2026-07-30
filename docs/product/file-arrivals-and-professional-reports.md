# File arrivals and professional reports

BuBu closes recurring local spreadsheet work without turning a watched folder into an unreviewed automation surface.

## Approved local folder arrivals

The user explicitly approves one local folder from the periodic-work center. Electron main supervises the OS watcher and keeps full paths private. The renderer receives only a bounded file name, opaque arrival id, candidate data-object labels, confidence, state, and safe remediation copy.

For each new CSV, TSV, or XLSX, the Go data core performs a read-only source inspection. It returns source kind, normalized columns, table identity, and bounded row counts without creating a dataset or version. Pure product policy combines that evidence with current object identity, historical source names, display names, source kind, Schema, and row-count profile. An exact historical source can still be demoted when the authoritative Schema differs.

Every arrival remains review-first:

1. BuBu records a stable size/modified-time signature and deduplicates repeated watcher events.
2. The user reviews the recommended replacement target and its reason.
3. Go verifies the file has not changed since detection.
4. Go either creates one immutable version or returns an explicit Schema mapping requirement.
5. Only an accepted replacement activates the existing derived, Reconcile, and workflow trigger queues.

Ambiguity, Schema drift, a still-changing file, an unsupported source, or a failed local replacement never changes the current version. The item remains recoverable or can be explicitly ignored. Restart reloads the bounded private arrival state. Existing files are not silently imported when a folder is approved. Email attachments, cloud drives, and business connectors remain outside V1.

## Professional evidence bundles

Clean, Reconcile, and reviewed local analysis can export one atomic professional report directory. Every format is generated from one strict `ReportBundleInput` model:

- `report.html`: standalone offline reading copy;
- `report.pdf`: the same offline HTML rendered by the packaged Electron print engine;
- `report.xlsx`: a styled Summary sheet plus one filtered evidence Sheet per table, with semantic column widths, wrapped long identifiers, frozen headers, and print settings;
- one Excel-safe UTF-8 CSV per evidence table;
- `manifest.json`: generation metadata plus size and SHA-256 for every delivery file.

The application writes into a private temporary directory, generates every required format, hashes the files, writes the manifest, and only then atomically publishes the directory. Failure removes the temporary directory and never exposes a partial bundle.

Deterministic facts, quality evidence, exceptions, limitations, lineage, and run metadata are visually and structurally separate from optional model narrative. Model narrative is marked non-authoritative and cannot replace control totals, quality results, approval fingerprints, or immutable source versions.

PDF evidence cards use adaptive columns and break long version ids, Artifact ids, and plan fingerprints inside their own bounds. Print tables wrap wide evidence instead of clipping it. The XLSX carries the same safety properties into spreadsheet viewers: readable labels, visible long values, styled headers, frozen rows, and evidence-table filters are generated in the OOXML package rather than depending on a particular Excel installation.

For reviewed analysis results, **组合专业报告** lets the user edit the bounded title and execution summary, then include or exclude safe chart-data Sheets, plan lineage, run metadata, and limitations. The complete local result table and deterministic row/column/truncation facts are mandatory. Each chart Sheet contains only an existing unique dimension and one approved numeric output, with no new grouping or calculation. Every selected section is parsed again in Electron main before the same atomic multi-format writer runs.

Reconcile report tables use the current bounded safe evidence view when an Artifact is larger than the UI/export budget. The report states that limitation and keeps the full classification in the immutable local Artifact. It never represents a bounded delivery table as the complete underlying Artifact.

## Local product evidence

Content-safe local events measure folder approval, arrival detection, candidate review, replacement approval, pause/recovery, recurring result readiness, report delivery, and next-cycle return. They do not store folder paths, file names, prompts, model output, row values, cell values, or thread identity. Cross-user telemetry remains opt-in and is not part of V1.
