# Reference Desktop Performance — 2026-07-17

This is measured release evidence for BuBu's local data kernel, not an estimate. The benchmark creates a deterministic clean CSV larger than 100 MiB, launches the built Go sidecar with a new temporary SQLite directory, imports and profiles the file through authenticated product RPC, warms one safe analytical query, measures five more executions, checks budgets, and deletes all generated user data.

## Reference device

| Property | Value |
| --- | --- |
| CPU | Apple M1 Max, 10 logical cores |
| Memory | 32 GiB |
| Platform | macOS Darwin 25.6.0, arm64 |
| Node | v22.18.0 |
| Go | go1.26.4 darwin/arm64 |
| Source revision | `219c506fc3d1b0ef59d57ff92cfb1913c52b793b` |
| Measured at | 2026-07-17T05:43:53.215Z |

No hostname, serial number, source path, or user dataset is recorded.

## Workload and result

| Measurement | Evidence | Release budget | Result |
| --- | ---: | ---: | --- |
| CSV size | 104,858,057 bytes / 100 MiB | at least 100 MiB | Pass |
| Shape | 183,246 rows × 10 columns | at least 100,000 rows | Pass |
| Import plus all 10 column profiles | 3,773.79 ms | at most 120,000 ms | Pass |
| Go data-core peak resident memory | 33.11 MiB | at most 256 MiB | Pass |
| Safe aggregation query samples | 153.56, 164.36, 158.32, 156.80, 157.45 ms | five measured runs | Pass |
| Query p95 | 164.36 ms | at most 3,000 ms | Pass |
| Resulting SQLite database | 123,658,240 bytes / 117.93 MiB | informational | — |

The query scans the 183,246-row current version, excludes cancelled orders with a bound filter, groups by eight regions, and calculates sum, average, and count through the same typed safe-query compiler used by the product. The warm-up is excluded; all five reported samples are parsed through the public result contract.

Peak RSS is sampled from the sidecar every 250ms where the host exposes `ps`. It is a guardrail, not the proof of streaming by itself. The executable architecture gate separately rejects whole-file CSV reads, requires 64 KiB-bounded delimiter detection, and the importer walks rows through `encoding/csv` into a prepared SQLite statement.

## Reproduce

```bash
volta run npm run verify:performance
```

The command regenerates the fixture; it never relies on a committed 100 MiB artifact. It fails when input size/row count, import time, query p95, or measurable peak RSS exceeds the checked-in budgets. `npm run verify` includes this gate, so a release cannot silently omit it.

The benchmark is local and deterministic. It makes no model or network request and cleans its temporary source/database unless `BUBU_PERF_KEEP_TEMP=1` is explicitly set for diagnosis.
