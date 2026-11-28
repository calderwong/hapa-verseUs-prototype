# Base Hapa Node Standard — governance and updates

**Standard:** Base Hapa Node Standard  
**Version:** `0.1.0-draft.1`  
**State:** draft, published as source for implementation review  
**Publication state:** `bootstrap_source_only`  
**Canonical source:** `calderwong/hapa-second-brain-node/docs/standards/base-hapa-node/0.1.0-draft.1/`  
**Companions:** [STANDARD.md](STANDARD.md), [IO_BAR.md](IO_BAR.md), [CONFORMANCE.md](CONFORMANCE.md), [release.json](release.json)

This document defines how Hapa maintains, distributes, and adopts the Base Hapa Node Standard. It also defines the recurring checks that future implementations must perform. Publishing this draft does not activate a scheduler, register a node, ingest a release into a live Second Brain ledger, or establish a signing key. Those states remain unset until the responsible implementation returns evidence.

## 1. The ownership rule

Hapa Second Brain is the designated home for this standard's maintained source, decision history, future releases, and adoption records. The Hapa Wiki carries its human-readable explanation. Every repository that contains a Hapa Node carries a pinned copy and its own adoption record.

This is an explicit ownership change **for the Base Hapa Node Standard only** from the older app-facing Hapa Protocol Standards summary, which identified a Wiki page as canonical. It does not transfer ownership of unrelated domain Wiki canon, raw evidence, private memory, or other protocols. Live implementation and execution evidence continue to determine what actually works.

The existing **Hapa connectivity contract v0.1 remains a separate protocol with its current Versus canonical source**. This standard references that work; it does not silently move or supersede it. A later transfer of any separate protocol requires its own recorded ownership decision.

A release's authority comes from its verified owner binding and content identity. A mutable branch name, display name, familiar URL, or responsive mirror is not sufficient authority. The same authorized release may be delivered through several providers and transport methods without changing who owns it.

## 2. What the different states mean

Keep these four questions separate in documentation, manifests, dashboards, and API responses:

| Question | Example states | Evidence needed |
| --- | --- | --- |
| What is the standard? | draft, released, superseded, withdrawn | Versioned bundle, content hashes, owner decision, release record |
| What does this node target or adopt? | unassessed, targeting, adopted, migration pending | Node adoption record referencing an exact bundle |
| What has the node implemented? | planned, partial, implemented, blocked | Capability mapping and implementation/build references |
| What has been verified? | not tested, pass, fail, stale | Criterion-specific evidence with its actual scope |

Copying the documents satisfies a distribution step. It does not implement the standard. A declaration of implementation is not a successful test, and a successful local fixture is not a two-network result.

“Meets Base Hapa Node Standard” is a versioned, scoped claim governed by [CONFORMANCE.md](CONFORMANCE.md). Required registrations need authentic acceptance evidence. A temporary deviation remains visible as a gap or conditional adoption; it does not silently become a pass. A mandatory pillar cannot be waived by calling it not applicable.

A newer standard does not rewrite historical evidence. A node can retain a valid claim about an earlier version and build while also reporting that a migration is pending. Recheck evidence when a relevant implementation, platform, contract, trust policy, or dependency changes. Calendar age alone must not cause expensive unrelated testing.

## 3. Which entity registers

Three different entities need clear names:

- **Node definition:** the maintained application or service, including its purpose and capability contract.
- **Node instance:** an independently owned installation with its own identity, storage, configuration, and lifecycle.
- **Repository:** a source location that may contain one node, several nodes, or only supporting material.

Each node definition has its own board and its required Quest Keeper, Telemetry, Second Brain, and Wiki bindings. Runtime instances retain their own cryptographic identities and use operational registrations appropriate to their owner's authorized scope. A definition entry is not proof that every installation has registered. Conversely, adopting this standard does not authorize publicly listing private installations or exporting their telemetry.

Classify repository roles explicitly before syndication. A reusable library or documentation repository is supporting material rather than an invented standalone node. It links to the standard and its consumers. An independently operating service is a node even if its primary user is another application; it still needs the four required management surfaces. A repository containing multiple nodes lists their separate bindings and adoption records.

The governance services themselves are nodes. They can bootstrap locally and reconcile registrations later. They must not require every other registry to be online before any node can start. A self-issued receipt must be identified as self-issued; it is not independent verification.

## 4. The repository kit

### HN-UPDATE-01 — Pin the adopted standard

Every Hapa Node repository MUST carry the following materials or their explicitly declared location:

| Material | Purpose |
| --- | --- |
| `STANDARD.md` | The seven pillars and common node contract |
| `IO_BAR.md` | The I/O Bar interaction and event contract |
| `GOVERNANCE.md` | Ownership, publication, recurring checks, and adoption rules |
| `CONFORMANCE.md` | Criteria, evidence, and permitted claims |
| `schemas/` and `templates/` | Machine-readable contracts and starting records included in the release |
| `release.json` | Exact file manifest and bundle identity |
| Root `hapa-standard.json` | Node-specific standard sidecar, pin, adoption state, and links |
| `docs/HAPA_NODE.md` | Readable node-specific adoption, implementation mapping, current gaps, and evidence links |

The existing `hapa-node.json` remains the node's existing identity/interface manifest. The new sidecar extends standard-adoption information without replacing or silently migrating that file. Link the sidecar and adoption document from the README and contributor/agent instructions.

Mirrored release files MUST remain byte-identical. Node-specific explanations and deviations belong in the sidecar and adoption document. Never edit the shared text locally to conceal divergence. A monorepo can store one shared bundle and give each node a separate sidecar or clearly indexed adoption entry.

The pin identifies the standard ID, exact version, bundle hash, immutable source reference, and current adoption state. Standard version, schema version, implementation version, build digest, and evidence revision remain distinct. Unknown bindings are explicitly unset; examples are never treated as live identities or service addresses.

The sidecar's `target_version` and adjacent bundle fields describe the proposed target. Its separate `adopted_pin` preserves the current adopted version, both hashes, source and adoption record. During `migration_pending`, retain that complete adopted pin even when the target changes. An assessment names its own standard version and build; validators must check it against the referenced report and pin. Template hashes remain null while `unassessed` to avoid self-referential or invented hashes; actual targeting/adoption records contain computed values.

Public manifests contain only source-safe material. Credentials, invitation secrets, private histories, local database contents, and private endpoint details stay in the appropriate protected store. A public record may link to restricted evidence without publishing it.

## 5. Registration and memory updates

Use a shared registration envelope with service-specific adapters. The adapter must use the actual owner-supported interface; the standard does not invent existing routes.

| Required binding | What acceptance establishes |
| --- | --- |
| Hapa Kanban | A real node-owned board, its owner/visibility, and its binding to the node |
| Hapa Quest Keeper | The node's purpose, capabilities, ownership, lifecycle, and board reference are recognized |
| Hapa Telemetry | The node's telemetry schema/catalog and collection/export policy are recognized |
| Hapa Second Brain | The node's documentation, source lineage, memory-update ownership, and references are recognized |
| Hapa Wiki | A real readable entry exists with appropriate source and ownership links |

Persist a registration or update intent before sending it. Give it a stable operation ID, subject and scope, intended service identity, content digest/revision, permitted disclosure, and source references. Retries use the same operation ID for the same content. A changed request is a new revision. Reconcile existing bindings after restart instead of creating duplicate boards and entries.

Acceptance evidence binds the service, subject, submitted content identity, accepted scope, and actual record reference. `Request sent` does not mean `accepted`. Useful states are `unknown`, `not_configured`, `pending`, `accepted`, `rejected`, `stale`, and `revoked`. Reachability and last receipt verification are separate observations: a service can be temporarily unreachable while its earlier acceptance remains valid.

All required registration intents must eventually be reconciled for full conformance. An unavailable governance service causes a visible pending or degraded state, not loss of local work, editing, play, or history inspection.

### Documentation and memory triggers

Append a durable update intent when a meaningful event changes the node's explanation:

- Initial requirements and the first working implementation.
- Accepted requirement changes, architecture decisions, or corrections.
- Added or removed capabilities and changed interaction-surface support.
- Protocol, schema, permission, identity, or provider changes affecting consumers.
- Releases, package/platform support changes, and material verification results.
- Incidents, failed assumptions, rollbacks, and recovery lessons.
- Standards adoption, deviations, or conformance changes.

The intent identifies the source records and affected documentation. Coalesce repetitive operational events; each telemetry sample must not become a Wiki edit. Generated summaries identify their inputs, generator, source revisions, and draft/accepted state. An AI-generated explanation does not become canon merely because it was generated. Corrections preserve the earlier account and append a superseding explanation.

Every surface distinguishes `queued`, `delivered`, and `accepted/projected` updates. A green memory-sync indicator cannot be based only on writing a local intent.

## 6. Recurring checks and integration points

### HN-UPDATE-02 — Check and reconcile on a declared schedule

The following are the proposed initial defaults for implementers. They are configuration requirements, **not active schedules established by this source publication**.

| Check | Default trigger/cadence | Result |
| --- | --- | --- |
| Runtime standards discovery | Startup or restored connectivity if the last successful check is older than 24 hours; at most once daily while running otherwise | Verified observed release and freshness; no automatic behavioral adoption |
| Repository mirror drift | Daily, before a release, and after a standards-release event | Pin/hash comparison and one deduplicated adoption task or proposed change |
| Registration and documentation reconciliation | Meaningful event, reconnect, and daily catch-up while the responsible service runs | Durable queue progress and actual acceptance/projected receipts |
| Second Brain adoption digest | Weekly | Current/behind/unknown nodes, deviations, blocked updates, and failed checks |
| Standards-owner review | Monthly and after material incidents or change proposals | A recorded change decision or explicit no-change result |

Second Brain already documents `grouping_refresh_registry`, `listen-sync`, and `auto-refresh-groups` as source-aware refresh mechanisms. The standards implementation SHOULD extend those existing integration points with an owned standards grouping, source signatures, dependencies, locks, cooldowns, and run evidence. It should not introduce a competing uncoordinated background loop. Documenting these integration points does not establish that standards synchronization is implemented in them today.

The schedule record contains the owner, trigger, cadence, last attempt, last success, next due time, observed release, result, error, and manual recovery action. Use bounded retries and jitter. Coalesce missed intervals into one catch-up check. Honor heavy-work controls, metered/offline operation, and the existing scheduler's locking model. A node that is stopped cannot perform runtime checks; the repository and Second Brain schedulers provide separate coverage where implemented.

Checks must not block application startup or discard the last verified adopted bundle. Report unknown freshness when connectivity or clock uncertainty prevents a reliable answer. An unavailable standards service does not invalidate existing application state.

The proposed logical operations are `standards.status`, `standards.check`, `standards.proposeAdoption`, `standards.recordAdoption`, and `standards.reconcile`. These are capability names for implementation mapping, **not declarations of existing CLI commands or API routes**. Implementers map them consistently into the node's shared feature spine and four interaction surfaces.

## 7. Publication integrity

### HN-UPDATE-03 — Verify the owner and the complete bundle

The initial bundle is a source-only draft. Its signer and live ledger record reference are unset. A released, signed publication must be a new immutable manifest/version; preserve this bootstrap record as historical evidence.

`release.json` lists every distributed bundle file by relative path, SHA-256, and byte size. Paths use `/`, are unique, and must not contain dot/parent or empty segments, a leading/trailing `/`, a backslash, drive/scheme prefixes, tabs, or line breaks. Reject normalized target collisions, including case collisions on a case-insensitive destination. Hash the exact file bytes. Include the documents, schemas, templates, and any other declared release files. The manifest itself and signature sidecars are excluded from the file list to avoid self-hashing.

### Exact bundle hash

1. Sort listed paths by their UTF-8 byte sequence.
2. For each file, emit `path`, a literal tab, lowercase 64-character SHA-256 hexadecimal, another literal tab, decimal `size_bytes` with no leading zeroes except `0`, then a literal LF.
3. Encode the concatenated rows as UTF-8, without a byte-order mark.
4. Compute SHA-256 over those bytes. Store the result as `bundle_sha256` using the release schema's declared representation.

This definition binds the paths, content, and sizes of the whole bundle. An implementer cannot mix an old schema with a new document and still pass verification. Verify every referenced file as well as the aggregate hash. Reject duplicate or unsafe paths, malformed digests, incomplete bundles, and unexpected attempts to overwrite unrelated repository content.

### Exact release signature

For a signed release, a detached `.sig` record signs the **exact stored bytes of `release.json`**. Do not parse and reserialize the JSON before verification. The authorized signature profile identifies the actual algorithm, public-key reference, signature encoding, signer scope, and release-byte digest. A signature sidecar is not included in the bundle hash. The signed manifest binds the complete file manifest, bundle digest, standard/version, release sequence, predecessor, compatibility/migration information, and owner decision references.

The initial trusted owner/key binding must come from the real owner's approved baseline through an independently authorized channel. Do not use trust-on-first-use merely because a mirror supplies a key. Key rotation follows the actual recorded continuity or recovery policy. A new endpoint cannot declare a replacement key trusted by itself.

Reject unauthorized signatures, conflicting bytes for the same released version or sequence, unapproved downgrades, and authenticated but unresolved release forks. Preserve conflict evidence and obtain the owner's recorded resolution. Metadata freshness, availability, authenticity, and content integrity are separate claims. A valid older signed bundle is not proof that it is the latest release.

A production automated distributor should evaluate an established secure-update implementation. TUF is a useful design reference for trusted metadata and rollback/freeze protection; this draft does not require or claim TUF implementation or conformance.

## 8. Adoption and deviations

### HN-UPDATE-04 — Record decisions and preserve local differences

Use this sequence for an update:

1. **Propose in Second Brain.** Record the reason, affected requirement IDs, source evidence, compatibility impact, and migration plan.
2. **Review with the actual owner.** Record the decision and affected node owners' adapter considerations. A governance record does not grant runtime permissions.
3. **Publish an immutable release.** Bind the entire bundle and record its owner-authorized publication.
4. **Distribute through available routes.** Nodes verify against their existing trust binding, independently of the chosen mirror.
5. **Propose node adoption.** Prepare a reviewable pin/mirror change and only the relevant gap tasks. Retain the node's adopted version until the adoption decision applies.
6. **Implement and verify.** Test the changed obligations and concrete risks; keep evidence scope explicit.
7. **Record the outcome.** Append the adopted version, implementation/build, remaining deviations, and evidence. Obtain real Second Brain/Wiki update receipts where applicable.

The default policy is `detect-and-propose`. Authorized local policy may permit caching a verified release or updating documentation mirrors. Neither action automatically authorizes executing downloaded code, widening telemetry disclosure, enabling networking, changing keys, installing binaries, or destructive migration. Those actions use the node's normal authority and controls.

A local deviation records the requirement, reason, owner, scope, effect, mitigation or migration task, review trigger, and evidence. It does not edit the mirrored standard. Preserve rejected proposals and resolved deviations in history. `Not applicable` is available only when the standard defines an applicability condition; it is not an escape from one of the user's seven mandatory pillars.

Update the release files and lock atomically: either the old complete bundle or the new complete bundle remains usable. Never present a mixed bundle as verified.

## 9. Versioning, deprecation, and recovery

Use Semantic Versioning for the declared standard contract. After 1.0, a patch does not change mandatory obligations or wire meaning; a minor version adds compatible optional behavior or deprecation guidance; a major version changes obligations incompatibly. Adding a mandatory criterion that previously conforming nodes fail is not a wording-only patch. During 0.x development, label the contract unstable and document every breaking migration. Published version bytes never change.

Deprecations name the replacement, affected scope, migration guidance, and support window when established. Preserve the ability to interpret retained historical records. Do not invent an ecosystem support guarantee or silently discard an old schema's meaning.

A rollback is a new authorized decision referencing an older usable bundle or implementation. It advances governance history without erasing the failed release or lowering the trusted sequence. A withdrawal is an appended record with replacement guidance; historical evidence remains addressable.

Offline nodes retain the last verified adopted standard for existing operation and show update freshness accurately. A failed refresh cannot justify adopting unverified content. If the owner key is lost or compromised, follow the documented recovery authority; a familiar URL is not a recovery key.

## 10. Acceptance checks

The conformance record should include focused evidence for these cases:

1. Document presence alone cannot produce a conformance claim.
2. Registry outages leave local work usable; queued intents survive restart and do not create duplicate boards or entries.
3. Receipts for the wrong subject, service, content, or revision do not fulfill registration.
4. Exact bundles from two permitted routes verify identically; altered files or unsafe paths fail.
5. A release notification cannot execute code or expand permissions.
6. Stale metadata, a missing key-rotation link, and a conflicting release branch have distinct outcomes.
7. Interrupted adoption preserves a complete prior or new bundle and a matching pin.
8. Corrections, withdrawals, and rollbacks retain original decisions and evidence.
9. Meaningful changes produce deduplicated memory/documentation work; repetitive telemetry does not flood the Wiki.
10. Check status distinguishes configured schedules, actual attempts, successful execution, and authentic downstream receipts.

## References and current boundary

- [Existing app-facing Hapa Protocol Standards](https://github.com/calderwong/hapa/blob/main/docs/HAPA_PROTOCOL_STANDARDS.md): earlier Wiki-canon rule and shared feature-spine expectations.
- [Second Brain grouping refresh plan](https://github.com/calderwong/hapa-second-brain-node/blob/main/docs/GROUPING_AUTO_REFRESH_PLAN.md): documented refresh registry, listener, runner, source signatures, dependencies, and run evidence.
- [Second Brain CLI](https://github.com/calderwong/hapa-second-brain-node/blob/main/docs/CLI.md) and [parity record](https://github.com/calderwong/hapa-second-brain-node/blob/main/docs/HAPA_PROTOCOL_PARITY.md): existing interfaces to extend and their stated caveats.
- [Separate Hapa connectivity v0.1](https://github.com/calderwong/hapa-verseUs-prototype/blob/main/docs/protocols/hapa-connectivity-v0.1.md): current canonical connectivity contract remains in Versus.
- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html): version meaning and immutable released versions.
- [TUF specification 1.0.36](https://theupdateframework.github.io/specification/v1.0.36/): secure-update design reference, not a selected Hapa dependency.

The source publication can be reviewed and mirrored now. Live Second Brain ingestion, owner signing, authentic registration, and scheduled standards syndication require the bounded implementation work described in the accompanying handoff. Their completion must be demonstrated, not inferred from this document.
