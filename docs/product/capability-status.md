# Product capability status

BuBu is currently a **private beta** distributed through the **preview** channel. “Implemented” in a detailed engineering ledger does not by itself mean generally available: product status also requires a coherent user outcome and, where applicable, external delivery evidence.

| Capability | Status | User outcome |
| --- | --- | --- |
| `local-first-data-workspace` | `available-local` | Import, inspect, query, and retain spreadsheet data under local authority. |
| `clean-merge-compare-reconcile` | `available-local` | Review deterministic transformations and matching before immutable results are created. |
| `conversation-evidence-and-reports` | `available-local` | Keep task history, artifacts, lineage, and exportable reports together. |
| `recurring-work-automation` | `available-local` | Re-run approved work locally with visible pauses, recovery, and evidence. |
| `privacy-retention-and-recovery` | `available-local` | Control disclosure, retention, backups, restoration, and local audit records. |
| `model-assisted-analysis` | `available-optional` | Use a configured model only through bounded, visible disclosure and one-use approval. |
| `local-knowledge-and-mcp` | `available-optional` | Add local knowledge and MCP capabilities without silently expanding model authority. |
| `encrypted-hub-collaboration` | `available-optional` | Sync explicitly selected encrypted workflow objects through an optional Hub. |
| `signed-public-distribution` | `external-evidence-required` | Release machinery exists, but signed/notarized public artifacts are not yet proven. |
| `design-partner-validation` | `external-evidence-required` | Product validation requires consented real-user evidence that is not yet collected. |
| `enterprise-horizontal-scale` | `future` | Normalized, horizontally scalable enterprise Hub operation is not part of this beta. |

Status meanings:

- `available-local`: complete in the local product path and does not need an external service.
- `available-optional`: complete only when the user deliberately configures the optional dependency and approves its boundary.
- `external-evidence-required`: engineering preparation exists, but the user-visible delivery claim remains incomplete until independently observed evidence is attached.
- `future`: intentionally outside the current product.

The compact table is the product-facing ledger. [PRODUCT_MANIFEST.yaml](../../PRODUCT_MANIFEST.yaml) remains the machine-readable authority and retains detailed engineering capabilities for executable verification. Runtime, documentation, tests, verifiers, and external evidence must agree before a status can advance.
