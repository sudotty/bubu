# Local data quality and validation

BuBu turns baseline import profiles into a local quality report for every dataset contact. The report is always tied to the contact's current immutable `versionId`, so replacing a recurring file automatically reruns the same stable business rules against the new version.

## What the report contains

- A deterministic 0–100 score derived from visible findings and rule failures.
- Per-column inferred type, null count/rate, distinct count/rate, and type-aware minimum/maximum.
- Bounded findings for empty datasets, all-null columns, high null rates, constant columns, and candidate keys.
- Saved validation rules and, for each rule, the failed row count plus at most 20 source row numbers.

The report does not include a hidden AI judgment. It also does not return raw failing values, prompts, SQL, source paths, or credentials.

## On-demand local distributions

Select a column in **列分布探查** to scan only that column in the current local version. This is deliberately separate from the report response, so opening a 500-column dataset does not calculate or move thousands of distribution values at once.

- Integer and real columns return a mean, numeric range, and ten equal-width histogram bins. A constant numeric column returns one bin.
- Text, boolean, and date/time columns return at most ten exact-value groups ordered by count and binary value, plus an `otherCount` for the remaining rows.
- Returned value previews are at most 120 Unicode characters. Tabs/newlines/control characters become visible safe glyphs, and a truncation marker tells the UI that the underlying grouped value was longer.
- Empty columns return an explicit empty result.

Every distribution carries a required `localOnly: true` marker. The typed preload exposes it only to the local renderer; query planning/model-context code has no distribution input. This lets the user inspect real high-frequency values without quietly broadening the default schema-plus-synthetic disclosure policy.

## Supported rules

- **Required:** null cells fail.
- **Unique:** every non-null duplicated row fails; use a separate required rule if null must also fail.
- **Number range:** one or both finite bounds; only inferred integer/real columns are accepted.
- **Pattern:** a 1–200 character RE2 expression, evaluated locally without catastrophic-regex backtracking.
- **Allowed values:** 1–50 distinct values, each at most 500 characters. Null remains independent from requiredness.

Saving replaces the contact's complete ordered rule set transactionally. The Go data core validates column existence, type compatibility, bounds, regular expressions, duplicates, and operand limits before storage. Rule SQL is built only from validated internal table/column identifiers and bound values; neither the renderer nor a model supplies SQL.

## Version behavior

Rules belong to the stable dataset contact, not one imported file. A replacement that preserves or explicitly maps the logical schema automatically evaluates the rules on the new current version. If a mapped replacement drops the logical column contract, the replacement itself is rejected before validation can run.
