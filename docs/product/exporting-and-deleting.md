# Exporting and deleting local datasets

Status: Implemented for current-version CSV export and permanent dataset deletion.

## Safe export

Use **安全导出 CSV** on a data contact. Electron presents a native save dialog and passes the selected destination directly to the Go data core. The renderer receives only the final file name, row count, dataset/version identities, and export mode; it never receives the destination directory or absolute path.

BuBu exports the contact's current immutable version in stable row and column order. The data core streams rows into a mode-`0600` temporary file in the destination directory, flushes and syncs it, and then publishes it by rename. The CSV is UTF-8 with a BOM for current Excel versions. Text cells whose first non-whitespace character is `=`, `+`, `-`, or `@` receive a leading apostrophe to prevent spreadsheet formula execution. Numeric negative values are not modified.

The export is deliberately CSV-only. It does not export historical versions, charts, conversations, validation rules, or an `.xlsx` workbook. Exporting creates an external copy: later deleting the BuBu contact cannot remove that copy.

## Permanent deletion

Use **永久删除** only when the whole local data contact should be removed. Electron displays an operating-system warning that names the contact and requires the destructive button; cancellation has no side effect.

One data-core transaction removes:

- every immutable version and its physical SQLite table;
- catalog, column profile, validation-rule, and relationship state;
- the dataset conversation;
- membership from every data group;
- any affected two-member group, because it would otherwise have fewer than two members, including that group's conversation.

Groups with at least two remaining contacts survive and receive a new update timestamp. A dataset may belong to at most 100 groups, so the typed deletion result remains bounded. Deleting a group never deletes its datasets, and deleting a BuBu dataset never deletes the original source file.

Deletion is irreversible in the current product. Export first when a portable row copy is needed. Backup/recovery and retention policy are separate Stage 2 capabilities and must not be inferred from this operation.

## Failure behavior

- A missing/stale dataset identity, non-CSV destination, unavailable directory, write error, or cancellation fails without reporting success.
- An incomplete export removes its temporary file.
- Dataset deletion commits the catalog/dependent-state changes and physical-table removal together; an error rolls back the transaction.
- Neither operation sends rows to a model or network service.
