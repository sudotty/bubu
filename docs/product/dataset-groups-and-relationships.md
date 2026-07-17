# Dataset groups and reusable relationships

A dataset group contains 2–8 stable dataset contacts in an explicit order. It stores membership only; it does not copy rows. Every read resolves each contact's current immutable version.

## Lookup relationship direction

A reusable relationship is directional:

`detail/many-side column → lookup/one-side column`

The right side must be non-null and unique in its current version. Both columns must exist and have the same inferred type, except integer and real are mutually compatible. This prevents a saved relationship from silently creating a many-to-many row explosion.

BuBu discovers bounded candidates locally when an earlier group member and a later member have same-name, type-compatible columns and the later right side is a valid lookup key. This direction matches the group planner's connected-tree ordering. Users can save a candidate or manually choose both endpoints. No model participates in discovery or validity checks.

## Replacement behavior

Relationships belong to stable dataset contacts and logical column names. They survive compatible or explicitly mapped replacements. Every group read reassesses both current versions:

- `missing-column` when a current logical column is unavailable;
- `type-mismatch` when current inferred types no longer match;
- `right-not-unique` when the right side gains nulls/duplicates or becomes empty.

Invalid relationships remain visible for repair or deletion, but are never disclosed to a model as usable hints.

## Model disclosure and execution

For a group question, Electron main converts only currently ready relationships whose left source precedes the right source into ordered source-index/column hints. The model receives those hints together with the already-visible schema and locally generated synthetic examples. It does not receive dataset names, source paths, profile values, relationship findings, or raw rows.

A hint is advisory. The model still returns the strict connected-tree group plan, the user still reviews and approves it, and Go still revalidates current versions, every column, the right-side unique key, join order, filters, and result limits before local execution.
