# Base Hapa Node conformance catalog

**Candidate:** `0.1.0-draft.1` · **Status:** draft, unratified · **Published:** 27 November 2026

The [machine-readable catalog](conformance-catalog.json) defines **42 mandatory requirements** for this candidate. It contains future acceptance scenarios and expected observations. **No case was executed by publishing this catalog, no requirement is marked passed, and no existing node is certified.** Ratification, implementation, execution evidence and adoption are separate events.

## Coverage

| Group | Requirement IDs | Count |
| --- | --- | ---: |
| Verifiable persistence | `HN-PERSIST-01`–`04` | 4 |
| Board and Quest Keeper | `HN-WORK-01`–`03` | 3 |
| Four interaction surfaces | `HN-SURFACE-01`–`03` | 3 |
| Documentation and provenance | `HN-DOCS-01`–`03` | 3 |
| Telemetry | `HN-TELEM-01`–`03` | 3 |
| Second Brain and Wiki | `HN-MEMORY-01`–`03` | 3 |
| I/O Bar | `HN-IO-01`–`08` | 8 |
| Identity and continuity | `HN-IDENTITY-01`–`02` | 2 |
| Authority and idempotency | `HN-AUTH-01`–`02` | 2 |
| Lifecycle and recovery | `HN-LIFECYCLE-01`–`03` | 3 |
| Replaceable connectivity | `HN-CONNECT-01`–`02` | 2 |
| Portability and installed release | `HN-PORTABLE-01`–`02` | 2 |
| Updates and deviations | `HN-UPDATE-01`–`04` | 4 |
| **Total** | | **42** |

## How to record conformance

Create a node-specific evidence record; do not edit this mirrored catalog to make a node appear compliant. For each requirement, record its applicability, implementation location/version, actual outcome, source/build/artifact identity, evidence method/environment, direct result references and limitations. Keep `not implemented`, `not tested`, `partial`, `blocked`, `failed` and `verified` distinguishable. An unresolved mandatory gap prevents a complete “meets this standard” claim, even when its deviation is documented.

Evidence kinds are different observation boundaries, not a single ranking. A document review proves traceability; a controlled fixture proves only the scenario and real components identified; a runtime integration proves its actual runtime scope. Owner acceptance requires an authentic registry/board receipt. Installed execution requires the exact distributed artifact on the claimed platform. Each case names its minimum kind; a requirement's principal minimum does not waive differently scoped cases.

Use focused regressions for the stated failure boundaries and reuse still-applicable evidence. Run broader integration qualification at a coherent candidate, rather than treating this catalog as a demand to repeat every test after every edit. A validator may check record shape, coverage and references; it must not convert a declared scenario into passing behavioral evidence.

## Applicability rules that matter

- Original-media cases apply whenever a node accepts dependent content such as images or recordings. A node without those capabilities still owes durable local intent; it cannot mark the entire persistence pillar inapplicable.
- Every operating node provides UI, CLI, API and a desktop shell. Semantic parity allows different interaction styles; a reduced browser/export profile cannot erase the main node's missing surfaces.
- Every required registration needs actual owner acceptance. A queued request, local manifest, GitHub issue or copied documentation is insufficient. Reachability remains separate from accepted registration.
- `HN-PORTABLE-02` requires targeted installed qualification for every claimed supported desktop platform. Cross-building does not satisfy it. Consumer download handling, independent-network connectivity and human acceptance need additional direct evidence when those stronger claims are made; they are not universal substitutes for platform execution.
- Providers are tested only for roles a node implements. No requirement mandates deploying an archive, operating a VPS or introducing a universal runtime SDK.
- An initial source-only standards publication may remain explicitly `bootstrap_source_only`. It cannot masquerade as a signed canonical release, a Second Brain ledger acceptance or an activated recurring scheduler.

The catalog is public-safe. It expresses shared behavioral obligations without disclosing private application findings, endpoints, credentials, installation identities or data.
