# Import data into BuBu

## Supported files

BuBu currently imports `.csv`, `.tsv`, and `.xlsx`. Save older `.xls` workbooks as `.xlsx` or CSV first.

1. Open BuBu and choose **导入 Excel 或 CSV**.
2. Select up to 100 files in the operating-system file picker.
3. Wait for the new data contacts to appear in the left column.
4. Select a contact to inspect its row count, column count, inferred types, and first 50 local rows.

For a CSV or TSV, the first row becomes the column header. For an Excel workbook, the first non-empty row of each non-empty worksheet becomes its header and every such sheet becomes a separate contact. Duplicate or blank column names are renamed without changing the source file.

## What stays local

Import, hashing, type inference, profiling, SQLite writes, catalog listing, and preview all run in the local Go data core. BuBu does not call a model during import. The absolute source path is not written to the dataset catalog and is not returned to the renderer. The displayed source name is only the file name.

Blank cells are stored as null. Non-blank source values are preserved as text, so identifiers such as `001` do not silently become `1`. Type labels are local profile metadata used for later planning.

## Failure behavior

A single file selection is atomic. If any selected file is unsupported, unreadable, malformed, or contains a row wider than its header, BuBu rolls back every dataset created by that selection. Correct the source and import again.

Use **替换数据版本** on an existing contact for a recurring file. If the normalized columns are unchanged, BuBu creates an immutable next version and switches the contact only after the new version commits. If columns are missing, added, or reordered, BuBu reports the drift and keeps the current data unchanged until you map every stable current column to one distinct incoming column. Unmapped incoming columns are ignored. The selected source path stays in a one-use, ten-minute Electron main-process session and is never returned to the renderer or persisted in SQLite. After mapping, the Go data core validates the pairs again and atomically creates the next immutable version.

## Preparing reliable files

- Use one header row with meaningful, unique names when possible.
- Keep identifiers formatted as text if leading zeros are meaningful.
- Remove decorative title rows above tabular Excel data.
- Split unrelated tables into separate sheets or files.
- Save formula results before import if other software has not refreshed the workbook's cached values.
