# Hapa Node I/O Bar Profile

**Profile:** `hapa.io-bar`  
**Standard release:** `0.1.0-draft.1`  
**Observation schema namespace:** `hapa.io.observation/1`  
**Status:** proposed normative requirements for implementation and review. Publication of this profile does not establish that any application implements or conforms to it.

## 1. Purpose and scope

Every Hapa Node provides an **I/O Bar**: a compact view of information entering or leaving the node, expandable into an inspectable log and its supporting ledger evidence. It answers six questions: **What moved? In which direction? Between whom? How much and how quickly? By which route? What evidence supports the displayed outcome?**

The bar is shared application chrome. It must remain quieter than the user's task and must not obstruct a game, canvas, form, dialog or other primary control. The same authorized observations and actions are available through the UI, CLI, API and desktop shell. Surface parity does not require a graphical ticker in a terminal.

**MUST**, **MUST NOT**, **SHOULD** and **MAY** have the normative meanings defined by the Base Hapa Node Standard. Requirement IDs below are stable references for implementations and conformance reports. An implementation reports each requirement's actual status and evidence; a specification, screenshot or fabricated event is not proof of a live network path.

## 2. Requirements at a glance

| ID | Requirement | Minimum acceptance evidence |
| --- | --- | --- |
| HN-IO-01 | Modes, placement and display controls | Top/bottom, collapsed/expanded/hidden, restore, pause/live and restart-persistent preferences |
| HN-IO-02 | Honest traffic classification | The complete classification fixture in §4, including relayed P2P and unknown endpoints |
| HN-IO-03 | Receipt and outcome semantics | Independent sent, verified, admitted, applied, durable and retained observations with actual supporting scope |
| HN-IO-04 | Rates, retries and fanout | Correct byte boundaries and separate operation, attempt and recipient counts |
| HN-IO-05 | Privacy and safe inspection | Redacted defaults, authorized identifiers, inert untrusted links and controlled export |
| HN-IO-06 | Accessibility | Keyboard operation, reduced motion, pause/resume, focus preservation, reflow and non-color labels |
| HN-IO-07 | Surface parity | Equivalent authorized query, inspection, subscription and export through all four surfaces |
| HN-IO-08 | Ledger integrity and bounded pressure | Preserved authoritative history, declared ephemeral diagnostics, bounded queues and visible gaps |

## 3. HN-IO-01 — Modes, placement and controls

The bar MUST support `collapsed`, `expanded` and `hidden` display modes, and `top` or `bottom` placement. Users MUST be able to change placement, expand/collapse the bar, hide it, and restore it through an identifiable **Show I/O Bar** command in the application's View/settings surface. Preferences MUST survive restart through the node's declared settings persistence. Per-device presentation preferences MUST NOT unexpectedly reposition another person's interface.

The collapsed bar SHOULD contain a fixed status/rate segment, a gently moving event strip and persistent controls. On narrow displays it SHOULD shorten event summaries while preserving the status and expand controls. Full information MUST be available without waiting for a value to scroll into view. The expanded view MUST support filtering by direction, class, peer/service, data kind, outcome and time, with a clear-reset control.

The bar MUST support an explicit **Pause display** control. Pausing preserves the viewport and labels the display as paused, including its observation age. Resuming MUST offer **Jump to live**; it MUST NOT replay an unbounded animated backlog. The motion preference MUST support system preference, motion on and motion off. System reduced-motion preference MUST make automatic ticker movement static when system preference is selected.[^pause]

Display controls MUST be distinct from collection, retention, remote sharing and network controls. Hiding or pausing the bar MUST NOT stop an application operation, modify authorization, cancel network traffic or erase history. The expanded view MUST state whether observations are being collected locally and whether any are exported to another service.

Example summaries below are fictional UI copy, not observed activity:

> OUT · P2P · document update · Peer B · 2.4 KiB · sent; remote receipt unknown

> IN · LOCAL · capability response · Node A · 580 B · authenticated and admitted

> OUT · SERVICE · telemetry batch · configured collector · 8.2 KiB · HTTP accepted

## 4. HN-IO-02 — Traffic classification

The bar MUST distinguish the requested three classes and provide a neutral state for incomplete knowledge:

| Class | Meaning | Required supporting detail |
| --- | --- | --- |
| **LOCAL** | Authenticated Hapa nodes exchange information within an established same-device or local-network scope | Locality and its basis; endpoint identities; actual transport when known |
| **P2P** | Hapa peers exchange resource-scoped information under a distributed application protocol | Direct, relayed, gateway-assisted or unknown route; applicable peer and intermediary roles |
| **SERVICE** | A Hapa node communicates with a service acting in a centralized application or infrastructure role | Service purpose, endpoint/provenance when known, transport and receipt meaning |
| **UNKNOWN / OTHER** | The required relationship, Hapa identity binding or locality has not been established, or the endpoint is outside the three classes | What is known; what remains unknown; the basis for any later classification |

These labels MUST describe the communication relationship separately from the physical path. A private P2P exchange carried by a centrally operated blind relay remains **P2P**, with an explicit **Relayed** route indicator. The relay's control/discovery traffic can independently be **SERVICE** traffic. A central application API remains **SERVICE** over a direct connection.

Implementations MUST retain these independent dimensions:

| Field | Values or meaning |
| --- | --- |
| `direction` | `inbound`, `outbound`, `internal`; relative to the observing node |
| `relationship` | `hapa_peer`, `centralized_service`, `local_storage`, `other`, `unknown` |
| `locality` | `same_device`, `local_network`, `remote`, `unknown`; with an inspectable measured or declared basis |
| `path` | `direct`, `relayed`, `gateway`, `mixed`, `unknown`; actual observed path, not configured intention |
| `plane` | `application`, `discovery`, `control`, `replication`, `telemetry`, `diagnostics` |
| `data_kind` | A registered common kind or a namespaced application extension |

The headline class is a projection of these facts. A localhost socket, shared address prefix, VPN address, display name or successful connection alone MUST NOT establish locality, Hapa identity or authorization. A configured, selected or dialed relay MUST NOT be shown as carrying a connection without supporting observation. If a gateway terminates application trust, that dependency MUST be visible; the P2P color MUST NOT imply end-to-end peer authentication that the adapter does not provide.

An optional local-storage filter MAY show ledger I/O in neutral styling. A disk write MUST NOT be presented as a transfer to a second Hapa Node. A third-party peer without a verified Hapa binding MUST NOT be labeled as a Hapa peer solely because it uses Hypercore or another P2P library.

### Complete classification fixture

Every implementation MUST cover the following fixture, first with controlled inputs and then with appropriate adapter integration evidence. Rendering injected labels alone does not prove transport behavior.

| Fixture | Established facts | Expected class | Expected path / clarification |
| --- | --- | --- | --- |
| Local process peer | Two authenticated Hapa nodes on the same host, direct local IPC | LOCAL | Direct; same device |
| Local-network peer | Authenticated Hapa peers with established local-network scope | LOCAL | Observed direct/relayed/unknown path remains independent |
| Remote direct peer | Authenticated Hapa peers; distributed resource protocol; remote direct path observed | P2P | Direct |
| Remote relayed peer | Same peer relationship; observed encrypted peer stream through a central blind relay | P2P | Relayed; relay identified as an intermediary, not the application recipient |
| Central application API | Request to a configured central application service | SERVICE | Direct/relayed/gateway/unknown according to actual adapter evidence |
| Bootstrap provider | Discovery request to a bootstrap service | SERVICE | Discovery plane; not an application-data delivery |
| Unknown third-party peer | P2P transport connects, but a Hapa identity binding is absent | UNKNOWN / OTHER | May show known transport/path; no Hapa-peer claim |
| Localhost proxy | Local socket forwards to a remote central service | SERVICE | Gateway/proxy dependence; the logical exchange is not LOCAL |
| Trust-terminating gateway | Gateway authenticates/acts as application endpoint instead of providing end-to-end peer authentication | SERVICE or UNKNOWN, according to established role | Gateway; identify the trust termination; do not assert end-to-end P2P |
| Configured-only relay | Relay configured but no path evidence exists | Class from established relationship, if any | Unknown; never infer relayed carriage |
| Optional ledger write | Authoritative append on local storage | Neutral local-storage detail | Internal; no peer transfer |
| Conflicting/insufficient facts | Relationship or locality evidence is inconsistent | UNKNOWN | Retain conflicting evidence; do not select a reassuring label |

## 5. HN-IO-03 — Receipts, outcomes and evidence

The collector MUST emit immutable observations about an operation, and the view MUST project those observations into an inspectable timeline. A later receipt MUST NOT overwrite the historical meaning of an earlier attempt. The UI MUST NOT compress incomparable claims into a single generic “success” or “verified” state.

| Observation | Permitted claim | Not implied |
| --- | --- | --- |
| Queued / attempted | Local work was accepted or an attempt began | Bytes left the process |
| Sent at a named boundary | The adapter observed bytes handed off or written at that boundary | Remote receipt, acceptance or persistence |
| Received locally | The observer received bytes | Authenticated origin or authorized content |
| Origin authenticated / content verified | The stated channel, signature or digest check succeeded | Application admission, truthfulness or retention |
| Admitted | The application accepted the operation under a stated permission/rule state | Projection applied or data retained elsewhere |
| Applied | A named projection/version applied the operation | Remote application or complete asset availability |
| Durably appended locally | A durable receipt identifies the actual log position and scope | A remote holder or future availability |
| Remote receipt / replication observation | A named authenticated peer acknowledged a specified operation or block range under defined semantics | Global delivery, full-history possession or retention |
| Retention attestation | A named holder made a specified commitment about content, scope and term | A guarantee that the holder cannot lose data or become unavailable |
| Failed / rejected / cancelled / timed out | A stated stage failed or ended | A timeout proves no append occurred, or cancellation reverses a committed effect |

These observations may coexist. The bar MUST be able to represent **durable locally; not admitted under the current membership cut; not applied**, and **sent; result unknown; retry pending**. Stable operation identifiers MUST survive uncertain receipts and retries. Distinct attempts MUST remain distinguishable.

For Hypercore, the core/read key and discovery key have different meanings, and a signed head, block upload/download event, and observed remote contiguous range are distinct facts.[^hypercore] When block-level evidence is presented, it MUST identify the applicable core, fork/checkpoint, range, peer, observer and time. A retention claim requires separate explicit semantics. Application admission remains separate from cryptographic validity.

The bar MUST distinguish **Not instrumented**, **Unknown**, **Last observed …**, **No eligible route**, and a fresh measured zero. It MUST NOT render missing measurements as `0 B/s`, a known endpoint as “online,” or a remote assertion as an independently observed fact. A row MAY expose an authenticated peer assertion, but its signature verification MUST NOT be described as independent proof of the assertion's underlying claim.

### Observation envelope

The shared schema uses snake_case names. Optional fields are emitted only when known and applicable. Identifiers refer to the Base Standard's actual namespaces; this profile creates no DID method or deployed resolver.

```ts
type HapaIOObservation = {
  schema_version: "hapa.io.observation/1";
  event_id: string;
  observed_at: string;                  // Observer clock, RFC 3339
  occurred_at?: string;                 // Origin clock; not a total ordering
  node_id: string;
  instance_id: string;
  boot_id: string;
  producer: { adapter_id: string; adapter_version: string };
  sequence: number;                     // Monotonic per producer/boot stream
  operation_id?: string;                // Stable logical intent when established
  attempt_id?: string;
  session?: { session_id: string; generation: number };
  resource_ref?: string;
  direction: "inbound" | "outbound" | "internal";
  relationship: "hapa_peer" | "centralized_service" | "local_storage" | "other" | "unknown";
  locality: "same_device" | "local_network" | "remote" | "unknown";
  path: "direct" | "relayed" | "gateway" | "mixed" | "unknown";
  plane: "application" | "discovery" | "control" | "replication" | "telemetry" | "diagnostics";
  data_kind: string;
  sender_ref?: string;
  recipient_refs?: string[];
  observation: string;
  bytes?: ({ payload: number; wire?: never } | { wire: number; payload?: never }) & { basis: string };
  duration_ms?: number;
  outcome?: { code: string; retryable?: boolean; retry_after_ms?: number };
  evidence_refs?: string[];
  endpoint_refs?: string[];
  trace?: { trace_id: string; span_id?: string };
  visibility: "local_private" | "shared_scoped" | "public";
  coverage: "observed" | "sampled" | "aggregate";
  extensions?: Record<string, string | number | boolean | null>;
};
```

Observation names, extension namespaces and measurement bases MUST be registered or versioned in the bundle's telemetry vocabulary. The companion machine-readable schema governs exact validation. Array lengths, attribute sizes, byte counts and sequence values MUST be bounded; implementations MUST specify safe integer encoding beyond their runtime's exact integer range. An attacker-controlled operation ID MUST NOT collapse unrelated node/resource operations.

The `bytes` object contains **exactly one** of `payload` or `wire`, with the named measurement `basis`. Use separate observations with distinct event IDs for separate boundaries, retaining the same operation/attempt correlation. This prevents an ambiguous basis or accidental addition of overlapping byte totals. An absent `bytes` object means unknown size. The executable record-shape contract is [io-observation.schema.json](schemas/io-observation.schema.json); common observation names, data kinds and measurement bases are in [telemetry-vocabulary.json](telemetry-vocabulary.json). A namespaced string passing a pattern check does not itself register a new semantic convention.

In this profile `encrypted_stream` measures wire bytes; `application_payload`, `http_content`, `filesystem` and `estimated_payload` measure the named payload/content boundary. `adapter_reported` and registered extension bases require a declared adapter mapping. The schema enforces the known field/basis pairs. Valid timestamp syntax, real calendar values, nonzero trace IDs, actual sequence behavior and accurate adapter measurement still require semantic checks.

`event_id` supports de-duplication, not authentication. A shared collector MUST use the tuple `(node_id, instance_id, boot_id, producer.adapter_id, event_id)` as the deduplication key, and an export retry MUST preserve that tuple. Do not merge two observers' records merely because both use event ID `1`. A telemetry record MAY be anchored by its signed ledger position without signing every transient sample separately. The inspector MUST distinguish pending persistence, durably recorded observations, unverified imported records and records verified against an anchored history.

For OpenTelemetry interoperability, source and observed timestamps map separately; observer/producer metadata map to Resource and InstrumentationScope; trace/span identifiers map to their standard fields; observation names map to EventName.[^otel-logs] Implementations MUST pin the selected semantic-convention version and preserve the meaning of existing metrics. Hapa-specific admission and retention claims belong in a Hapa namespace.

## 6. HN-IO-04 — Rates, retries and fanout

The collapsed view MUST expose inbound and outbound size/rate where instrumentation supports them. A rolling average MUST identify its window, such as **5 s average**. Byte units MUST be explicit: B/s, KiB/s or MiB/s. Bits/s, if offered, is a separate labeled setting. Local duration and rate calculations SHOULD use monotonic time and an explicit counter epoch.

Implementations MUST satisfy these accounting rules:

1. Count one logical operation once per named operation/recipient/stage. Queued, sent and received observations are not three new operations.
2. Count retries separately from unique accepted operations. Retransmitted wire bytes count again as bandwidth.
3. Distinguish a fanout operation from recipient transfers. One operation sent to two peers is one unique intent and two recipient deliveries/attempts, as actually observed.
4. Never add application-payload bytes to encrypted-stream bytes or sum overlapping upper/lower instrumentation as independent transfers.
5. Label estimates. A batch declares its record count and measurement basis.
6. Preserve event IDs across telemetry export retries. Use a new boot/counter epoch after restart; do not show a negative or artificial throughput spike.
7. Disclose sampling/coalescing and omitted observation counts. UI coalescing MUST NOT change accurate counters that remain available.
8. Do not infer exact cross-node latency from unsynchronized wall clocks. Show an actual round-trip measure, a qualified synchronization assumption, or independent timestamps.

Suggested reference UI defaults are a one-second summary refresh, at most four data refreshes per second during active progress, and at most 200 mounted history rows with paging or virtualization. These are proposed tuning defaults, not benchmark results or universal performance requirements. Ticker motion SHOULD avoid data rerenders on every animation frame.

## 7. HN-IO-05 — Privacy and safe inspection

The bar is an authorized inspector, not a public transcript. Default summaries MUST use safe labels and truncated fingerprints. The collector MUST NOT capture payload bodies, document text, keystrokes, model prompts, private paths, authorization headers, bearer tokens, invitation secrets or secret keys merely to populate telemetry. Error reports MUST be sanitized before they reach any surface or exporter.

The inspector MUST provide typed identity and endpoint references:

- A real supported **subject DID**, with its method/resolution semantics, when one exists.
- The actual **Hapa node/resource ID** namespace.
- A **Hypercore public/read key**, distinctly labeled from a **Hypercore discovery key**.
- A **transport public key**, with its subject binding or an unbound label.
- A **service descriptor/endpoint URL**, separate from identity or availability.
- A specific **ledger position, checkpoint or proof**, with the claim and scope it supports.

Full values MAY be inspected or copied by an authorized user under the node's visibility policy. Public/read keys may locate sensitive resources; their cryptographic name does not authorize publication. Diagnostic exports MUST default to redacted, scoped aliases and MUST preview the identifiers/content explicitly selected for inclusion.

URLs MUST remove embedded credentials and sensitive query/fragment values from default displays and exports. Untrusted endpoint strings MUST be inert. Merely rendering or hovering a row MUST NOT fetch a URL, resolve an identifier, preload content or invoke an external handler. Explicit inspection uses the existing authorized resolver/transport policy, validated schemes and destinations. A recorded endpoint MUST NOT grant its own permission or change export policy.

Remote telemetry sharing MUST have an explicit destination, purpose, field scope and policy. Registering with Hapa Telemetry does not authorize exporting private application history. A collector outage MUST NOT prevent local authorized inspection.

The observer derives `visibility` from its local disclosure policy. A peer-supplied `public` label, identity string, endpoint or event field MUST NOT independently grant permission to publish or export data.

## 8. HN-IO-06 — Accessibility and visual language

Traffic classes MUST use visible labels and icons/shapes as well as color.[^color] Traffic type and severity MUST remain independent: SERVICE is not a warning, and P2P is not a safety assertion. Errors/warnings require their own text and indicators.

The component MUST support full keyboard access, visible focus, text enlargement and reflow. Expansion/collapse MUST preserve sensible focus, and closing a focused drawer MUST return focus to its trigger. Scrolling or focusing a history row MUST stop automatic follow; use a **New events** count and **Jump to live** control instead of moving the user's target.

Reduced motion MUST disable automatic horizontal movement and animated reordering. Explicit pause/resume remains available when reduced motion is off. Essential values MUST remain accessible without animation. The component MUST NOT flash, autoplay sound, steal focus for routine traffic or announce every packet to assistive technology. Significant status changes SHOULD use polite, programmatically available announcements and an on-demand summary.[^status]

Normal text MUST meet 4.5:1 contrast; meaningful controls and graphics MUST meet 3:1 against adjacent backgrounds under applicable WCAG criteria.[^contrast][^nontext] The complete component still requires inspection in each theme, state and supported accessibility mode.

### Reference palette

These optional tokens have the following calculated contrast on the stated backgrounds. They do not certify other background combinations or the entire interface.

| Class | On dark `#0B1220` | Ratio | On white `#FFFFFF` | Ratio | Visible label |
| --- | --- | ---: | --- | ---: | --- |
| Local Hapa | `#67E8F9` | 12.92:1 | `#0E7490` | 5.36:1 | LOCAL + linked-node icon |
| Decentralized Hapa | `#C4B5FD` | 10.14:1 | `#6D28D9` | 7.10:1 | P2P + peer-network icon |
| Centralized service | `#FCD34D` | 12.98:1 | `#92400E` | 7.09:1 | SERVICE + server icon |
| Other/unknown | `#CBD5E1` | 12.61:1 | `#475569` | 7.58:1 | UNKNOWN + neutral/question icon |

## 9. HN-IO-07 — Surface parity and implementation boundaries

UI, CLI, API and desktop shell MUST expose the same authorized information and equivalent query, inspect, subscribe and export operations. A desktop view MUST NOT claim a stronger receipt or healthier state than the API for the same evidence. A CLI MAY offer human-readable tables and a stable JSON mode without animating a graphic.

The shared interaction contract MUST cover these responsibilities; names below are illustrative, not assertions of deployed API routes:

```ts
io.status()                          // Collection state, counters, coverage, policy
io.query(filter, cursor, limit)       // Bounded observations and next cursor
io.subscribe(filter, cursor, limits)  // Cancellable bounded observation stream
io.inspect(event_id)                  // Authorized details and evidence references
io.export(selection, redaction_profile)
io.preferences.read()
io.preferences.update(changes)
```

Recommended reusable boundaries are semantics/schemas, a bounded collector and redactor, a ledger/query projection, the rendered bar component, and telemetry/export adapters. Application adapters retain ownership of domain admission, projection and receipt meanings. Sharing schemas and conformance fixtures does not require a large shared runtime framework.

## 10. HN-IO-08 — Ledger integrity, diagnostics and pressure

Implementations MUST distinguish three kinds of state:

| State | Persistence obligation |
| --- | --- |
| Authoritative application/audit records | Preserve append-only history under the Base Standard. The I/O subsystem cannot rewrite, silently prune or delete these records. |
| Telemetry observations deliberately promoted to canonical provenance/audit records | Preserve their appended authoritative history and evidence references. Calling a record “telemetry” does not authorize its deletion. |
| Explicitly ephemeral diagnostics and presentation samples | May use bounded volatile buffers and aggregation from collection time, with declared scope and coverage. They are never claimed as complete canonical history. |

High-frequency packet, pointer, heartbeat and progress samples SHOULD be ephemeral or aggregated unless a specific domain requires an authoritative record. Required domain decisions and receipts MUST NOT be silently downgraded to ephemeral diagnostics. Ticker position and current animation state are rebuildable presentation state.

The node MUST declare diagnostic sampling, queue limits, byte budgets, scope and coverage. Under pressure, it SHOULD coalesce or omit low-priority ephemeral samples, preserve available counters, and show **Telemetry incomplete** with omitted counts. It MUST NOT silently drop a required authoritative append and report it as recorded. If authoritative persistence fails, the affected operation MUST show its real failure or unresolved state.

Proposed optional diagnostic policies might retain non-authoritative detailed samples up to seven days/50 MiB and aggregates up to thirty days/10 MiB. These are design options, **not approved deletion policies**, not permission to prune an existing ledger, and not requirements to store those volumes. The policy must identify data as ephemeral from collection time rather than retroactively reclassifying authoritative history.

If a separately authorized replication policy permits eviction of a local non-authoritative replica segment, it MUST describe that action as a scope-specific availability change, preserve the relevant checkpoint/reference, and disclose the missing local coverage. The remaining reference MUST NOT be displayed as if the payload is locally present or independently retained elsewhere. Such eviction MUST NOT remove the authoritative holder's history, silently narrow a promised retention commitment, or become a general-purpose delete operation. This profile does not authorize or implement destructive retention changes.

Collector/export failure MUST NOT block an otherwise authorized edit, game action or file save. Collector queues and retry/backoff MUST remain bounded. Exporting telemetry MAY generate a bounded summary observation; it MUST NOT recursively generate an event for every exported event and export those in an unbounded loop.

The expanded ledger view MUST expose coverage and observation age. It MUST distinguish authoritative ledger records, derived projections, pending persistence, ephemeral observations and missing replica payloads. A checkpoint/hash without available payload is evidence of that checkpoint's scope, not a complete viewable history.

## 11. Acceptance and evidence

Each conformance report MUST bind the implementation/build, profile version, tested adapters and actual evidence tier. Required cases are:

| Case | Requirements | Expected result |
| --- | --- | --- |
| Mode and restart journey | HN-IO-01 | All modes/placements work and persist; hiding/pausing does not alter application traffic |
| Classification fixture | HN-IO-02 | Every row of §4 is classified honestly; relay configuration alone cannot create a relayed-path claim |
| No remote acknowledgment | HN-IO-03 | Local sent/durable facts remain distinct from remote unknown |
| Verified but excluded operation | HN-IO-03 | Cryptographic validity and local durability do not imply admission or application |
| Retry and two-recipient fanout | HN-IO-04 | Unique intent, attempts, recipients and compatible byte counters are correct |
| Restart and stale measurements | HN-IO-03/04 | New epoch, no negative spike, no duplicate accepted operation, explicit stale/unknown state |
| Secret and hostile endpoint fixture | HN-IO-05 | Secrets remain redacted across all surfaces; endpoint strings are inert without authorized action |
| Keyboard, zoom and reduced motion | HN-IO-06 | Controls and full information remain reachable; no focus/announcement flood |
| Same-record surface comparison | HN-IO-07 | All surfaces expose equivalent authorized observations and receipt semantics |
| Flood and collector outage | HN-IO-08 | Application remains responsive; queues stay bounded; omitted ephemeral coverage is visible |
| Authoritative history preservation | HN-IO-08 | Pressure and diagnostic policy do not delete or silently prune canonical application/audit records |
| Missing replica payload | HN-IO-08 | Checkpoint preserved, availability gap disclosed, no unsupported retention claim |

Evidence levels MUST remain distinct: schema/unit fixture, controlled adapter integration, installed package, independent machines/networks, and human usability observation. A screenshot supports a captured visual state, not continuous animation performance. A constructed relayed event tests classification/rendering, not an authenticated relayed exchange.

## References

The external sources support the identified primitive or accessibility requirement. Hapa's observation envelope, classifications, evidence rules, storage boundaries and suggested UI defaults are design requirements of this proposed profile; they are not claimed as automatic behavior of those libraries or standards.

[^pause]: W3C WAI, [Understanding SC 2.2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide). Includes a stock-ticker example and delayed/live resumption behavior.
[^color]: W3C WAI, [Understanding SC 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color).
[^contrast]: W3C WAI, [Understanding SC 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum). Palette ratios use the relative-luminance contrast formula against the stated backgrounds.
[^nontext]: W3C WAI, [Understanding SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).
[^status]: W3C WAI, [Understanding SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
[^otel-logs]: OpenTelemetry, [Logs Data Model](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/logs/data-model.md). Implementations pin a selected upstream version rather than treating this moving link as a release dependency.
[^hypercore]: Pear documentation, [Hypercore reference](https://docs.pears.com/p2p/reference/building-blocks/hypercore/). Documents core/discovery keys and transfer observations; it does not establish Hapa application admission or retention semantics.
