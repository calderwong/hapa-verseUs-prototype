# Source register and design decisions

**Prepared:** 2026-11-27 · **Scope:** source-grounded specification design, not a fleet runtime audit

## Primary design authority

CJ's instruction in the current design turn supplies the seven required pillars: append-only hashed peer-transferable primary persistence; own Kanban/Quest Keeper; UI/CLI/API/desktop parity; standard explanation and 0-to-1 provenance; Telemetry participation; Second Brain/Wiki participation and update triggers; and the new configurable I/O Bar. The preservation, provenance, multiple-route connectivity and modularity goals from the ongoing work constrain this design.

The 15 supporting requirements, event/schema details, proposed cadence and UI tuning values are newly formalized design recommendations. This is a draft target contract. The source instruction is described here without publishing the surrounding private conversation.

## Exact public source documents inspected

| Repository / revision | Documents inspected | Use and limits |
| --- | --- | --- |
| [hapa at f54bad269e20b6e64c43f4380ce26501e6d33684](https://github.com/calderwong/hapa/tree/f54bad269e20b6e64c43f4380ce26501e6d33684) | `AGENTS.md`, `docs/HAPA_PROTOCOL_STANDARDS.md`, `docs/NODE_MAP.md` | Existing feature-spine, docs, authority, parity and map conventions. The map itself says it is not a complete public-repository inventory. |
| [hapa-second-brain-node at bd05d2cbf6ffcb9f23e9d1c4f29d48c976cbd0dc](https://github.com/calderwong/hapa-second-brain-node/tree/bd05d2cbf6ffcb9f23e9d1c4f29d48c976cbd0dc) | `AGENTS.md`, `README.md`, `hapa-node.json`, `docs/API.md`, `docs/CLI.md`, `docs/HAPA_PROTOCOL_PARITY.md`, `docs/GROUPING_AUTO_REFRESH_PLAN.md`, `docs/HAPA_CONNECTIVITY.md` | Actual source owner, privacy boundary and documented interfaces/refresh mechanisms. Source says the private local data store is SQLite; a new ledger standard does not retroactively make that implementation compliant. |
| [hapa-quest-keeper at 5ff83f038fb8a047e141a72defe0a271a8338714](https://github.com/calderwong/hapa-quest-keeper/tree/5ff83f038fb8a047e141a72defe0a271a8338714) | `README.md`, `hapa-node.json`, `docs/PROTOCOL_AUDIT.md` | Existing per-node board and consolidated Quest Keeper model; documentation is not a live registration receipt. |
| [hapa-telemetry-node at fbe3c90ef4dd14df0169f1712f2d2dc4a95df14d](https://github.com/calderwong/hapa-telemetry-node/tree/fbe3c90ef4dd14df0169f1712f2d2dc4a95df14d) | `README.md`, `hapa_telemetry_node/registry.py` | Source-grounded discovery/registry role. No live node/metric census or registration was performed. |
| [hapa-worldbuilding-wiki at 5c6bfad2e3571670fb46700b10f7c47843e6f31f](https://github.com/calderwong/hapa-worldbuilding-wiki/tree/5c6bfad2e3571670fb46700b10f7c47843e6f31f) | `README.md` | Wiki ownership and source/publication boundary; no private Wiki corpus copied. |
| [Hapa connectivity v0.1 at 41c764038d50cee9c9848c67da1ab1a2ffbe0555](https://github.com/calderwong/hapa-verseUs-prototype/blob/41c764038d50cee9c9848c67da1ab1a2ffbe0555/docs/protocols/hapa-connectivity-v0.1.md) | Complete contract, particularly identity, providers, lifetime, assets and evidence | Existing separate shared design; ownership and protocol meanings remain unchanged. Generic lessons are incorporated without reproducing private consumer findings. |

The older `calderwong/hapa-second-brain` README was also inspected for orientation. The current source-node manifest, expanded interfaces and Hapa node map support using `hapa-second-brain-node` as this publication's source home. A local operator must still resolve the actual running instance before ingestion; a repository name is not a runtime address.

## Existing facts that affect the design

1. The app-facing protocol summary previously names the Wiki as canonical. CJ's current direction places **this new standard** under Second Brain. The new documents record that scoped transition and retain other domain owners.
2. The current source-node manifest uses logical ID `hapa-second-brain`. The draft preserves it and does not create a new cryptographic identity.
3. Current Second Brain documentation names an existing source-aware refresh registry, listener and runner. The handoff extends those mechanisms; it does not claim standards synchronization already exists.
4. The documented local Second Brain page could not be reached through the connected browser during this design pass. This observation establishes no live update, no service receipt and no scheduler activation. It does not diagnose why the operator's service was unavailable.
5. Current runtime and packaging lessons motivate stable operations, durable originals, generation fencing and evidence-qualified status. This standard is a contract; it does not assert those fixes exist everywhere.

## Primary external references

These references were opened during the design pass. They inform terminology and engineering choices; none grants Hapa certification, upstream affiliation or implementation maturity.

- [Hypercore reference](https://docs.pears.com/p2p/reference/building-blocks/hypercore/): log and key semantics.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/): structured observability mapping.
- [W3C DID Core](https://www.w3.org/TR/did-core/): identifier/method distinction; no new DID method is defined here.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/): trace/span identity interoperability.
- W3C accessibility references: [Pause/Stop/Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html): version/change discipline adapted to this standard.
- [TUF specification 1.0.36](https://theupdateframework.github.io/specification/v1.0.36/): secure-update design reference, not a selected dependency or compliance claim.

## Decisions and deliberately open bindings

| Decision | Status |
| --- | --- |
| Seven pillars and Second Brain custodianship | User-directed requirements |
| 42 traceable requirements / 87 declarative cases | Proposed first formal profile |
| Semantic parity across four surfaces | Proposed precise interpretation of the user's parity requirement |
| Public/read key, discovery key, transport identity and DID remain distinct | Selected correctness boundary for this draft |
| Shared schemas/adapters before a universal runtime | Architectural recommendation |
| Detect-and-propose; daily/weekly/monthly checks | Proposed defaults awaiting implementation |
| Actual standard signing key and recovery authority | Unresolved; do not invent |
| Live Second Brain record, Wiki entry and registry receipts | Pending real owner-supported ingestion/reconciliation |
| Active scheduler and fleet rollout | Pending implementation; not established by publication |
| Existing app conformance | Not assessed by this design pass |

