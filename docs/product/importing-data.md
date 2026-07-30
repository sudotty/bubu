# Import data into BuBu

## Supported files

BuBu currently imports `.csv`, `.tsv`, and ordinary unencrypted `.xlsx` workbooks. Save older `.xls`, encrypted, or externally linked workbooks as a self-contained `.xlsx` or CSV first.

1. Open BuBu and choose **导入 Excel 或 CSV**.
2. Select up to 100 files in the operating-system file picker.
3. Name the imported sheets, then wait for the new data objects to appear in the object list.
4. Select a data object to inspect its row count, column count, inferred types, and first 50 local rows.

For a CSV or TSV, the first row becomes the column header. For an Excel workbook, the first non-empty row of each non-empty worksheet becomes its header and every such sheet becomes a separate data object. Shared strings, inline strings, raw numbers, and the last cached value of a formula are read directly from the bounded OOXML package; formulas are never executed. Duplicate or blank column names are renamed without changing the source file.

## Try the bundled retail workspace

On an empty workspace, choose **打开零售经营示例** instead of selecting a file. BuBu imports three small, synthetic CSV files and creates:

- **零售订单** with order date, customer, region, category, revenue, and status;
- **区域目标** with one monthly target per region;
- **客户档案** with one segment per customer;
- two confirmed lookup relationships from orders to region targets and customer profiles;
- one weekly business topic named **零售经营周报**.

The example uses the same Go import, SQLite, relationship, business-topic, query, and workflow boundaries as user files. It does not configure a provider, send a request, or bypass plan approval. Setup is limited to an empty workspace; if any post-import step fails, BuBu removes the imported demo objects in reverse order.

## Try the bounded Merge task

On an empty workspace, choose **打开周期导出 Merge**. BuBu imports three synthetic weekly order exports with the same ordered schema, creates the local **周期订单合并** topic, selects the **追加周期导出** Clean template, and waits for you to choose the second source. **预览影响** shows the pinned source versions, row/column impact, operation list, quality proof, and plan fingerprint. **批准并创建数据对象** consumes a one-use approval and creates a new immutable derived object; neither weekly input is changed. Schema or column-order mismatch fails before approval.

## What stays local

Import, hashing, type inference, profiling, SQLite writes, catalog listing, and preview all run in the local Go data core. BuBu does not call a model during import. The absolute source path is not written to the dataset catalog and is not returned to the renderer. The displayed source name is only the file name.

Blank cells are stored as null. Non-blank source values are preserved as text, so identifiers such as `001` do not silently become `1`. Type labels are local profile metadata used for later planning.

## Failure behavior

A single file selection is atomic. If any selected file is unsupported, unreadable, malformed, contains unsafe external worksheet relationships, exceeds the bounded XLSX package limits, or contains a row wider than its header, BuBu rolls back every dataset created by that selection. Correct the source and import again.

Use **替换数据版本** on an existing data object for a recurring file. If the normalized columns are unchanged, BuBu creates an immutable next version and switches the object only after the new version commits. If columns are missing, added, or reordered, BuBu reports the drift and keeps the current data unchanged until you map every stable current column to one distinct incoming column. Unmapped incoming columns are ignored. The selected source path stays in a one-use, ten-minute Electron main-process session and is never returned to the renderer or persisted in SQLite. After mapping, the Go data core validates the pairs again and atomically creates the next immutable version.

After a source version activates, BuBu automatically creates one idempotent local task for every current dependent derived object. Compatible reviewed plans replay without a model call and create immutable next versions in dependency order. A schema mismatch or blocking Clean quality rule pauses the affected branch instead of promoting partial output. Open the derived object's **本地自动重算** section to inspect the trigger version, attempt count, completion evidence, or remediation reason; pending work can be cancelled and paused/failed work can be retried up to three attempts. Restarting BuBu returns an interrupted task to the queue. Desktop notifications contain only the object name and status, never source row values.

## Preparing reliable files

- Use one header row with meaningful, unique names when possible.
- Keep identifiers formatted as text if leading zeros are meaningful.
- Keep a table at or below 500 columns; this bounds local profiling, validation, model-context, and mapping surfaces.
- Remove decorative title rows above tabular Excel data.
- Split unrelated tables into separate sheets or files.
- Save formula results before import if other software has not refreshed the workbook's cached values.
