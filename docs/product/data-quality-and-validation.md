# Local data quality and validation

BuBu turns baseline import profiles into a local quality report for every dataset contact. The report is always tied to the contact's current immutable `versionId`, so replacing a recurring file automatically reruns the same stable business rules against the new version.

## What the report contains

- A deterministic 0–100 score derived from visible findings and rule failures.
- Per-column inferred type, null count/rate, distinct count/rate, and type-aware minimum/maximum.
- Bounded findings for empty datasets, all-null columns, high null rates, constant columns, and candidate keys.
- Saved validation rules and, for each rule, the failed row count plus at most 20 source row numbers.

The report does not include a hidden AI judgment. It also does not return raw failing values, prompts, SQL, source paths, or credentials.

## Supported rules

- **Required:** null cells fail.
- **Unique:** every non-null duplicated row fails; use a separate required rule if null must also fail.
- **Number range:** one or both finite bounds; only inferred integer/real columns are accepted.
- **Pattern:** a 1–200 character RE2 expression, evaluated locally without catastrophic-regex backtracking.
- **Allowed values:** 1–50 distinct values, each at most 500 characters. Null remains independent from requiredness.

Saving replaces the contact's complete ordered rule set transactionally. The Go data core validates column existence, type compatibility, bounds, regular expressions, duplicates, and operand limits before storage. Rule SQL is built only from validated internal table/column identifiers and bound values; neither the renderer nor a model supplies SQL.

## Version behavior

Rules belong to the stable dataset contact, not one imported file. A replacement that preserves or explicitly maps the logical schema automatically evaluates the rules on the new current version. If a mapped replacement drops the logical column contract, the replacement itself is rejected before validation can run.
