# Hapa connectivity contract v0.1

**Status:** review-selected design for implementation; no shared SDK, executable conformance suite, registered Protocol Card or deployed service is claimed.
**Canonical source:** [Hapa Versus docs/protocols](https://github.com/calderwong/hapa-verseUs-prototype/blob/main/docs/protocols/hapa-connectivity-v0.1.md).
**Mirror:** `hapa-flowcraft/docs/protocols/hapa-connectivity-v0.1.md`, byte-identical to the canonical document.
**Companion:** [declarative conformance cases](hapa-connectivity-v0.1-conformance.json). These cases are requirements, not passing test results.

## 1. Purpose and scope

Give Hapa applications reusable ways to find peers, authenticate a scoped connection, exchange authorized records, retain verifiable history and report useful connection state. Keep application rules and conflict semantics in application adapters.

The initial native implementation uses HyperDHT/Hyperswarm and Hypercore. Public discovery is the initial entry route; a VPS maintained by CJ is not required. A relay, replica, directory and future browser gateway remain distinct optional service roles. Actual network reachability and retention must be observed.

Normative words in this document describe the selected target behavior. They do not certify existing code. Protocol changes, implementations and evidence must be versioned separately.

## 2. Ownership and adoption sequence

1. The Versus agent stabilizes the existing native contact, provider-policy and connection primitives against this contract, preserving current game signatures and data.
2. The Flowcraft agent implements its document adapter as a second consumer of the same boundaries and supplies compatibility evidence.
3. A designated foundation owner coordinates common-contract changes. Both application owners review effects on their own adapters; the reviewer records conformance evidence and remaining gaps.
4. Extract a reusable package/module after both consumers demonstrate the boundary. Pin an explicit version/content digest and supported dependency versions.
5. Do not require a nonexistent package, mutable sibling checkout, global daemon, new DID method or new infrastructure deployment to complete either current app.

Until extraction, share this contract and fixtures with explicit implementation locations and version pins. Do not describe two diverging copied runtimes as one shared implementation. The canonical document and mirror must move together at a meaningful integration checkpoint, not after every local edit.

## 3. Identity and resource distinctions

| Value | Meaning | Must not be substituted for |
| --- | --- | --- |
| Root/subject identity | Authority that authorizes an application identity or delegated key | Display name, provider account, IP address or Yjs client ID |
| Transport key | Key authenticated by the native connection and explicitly bound to the subject | Root identity or permission to edit every resource |
| Writer/contact core key | Identity of an authenticated feed or contact history | Transport dial address |
| Core discovery key | Rendezvous identifier for peers sharing a core | Verification/read key or membership grant |
| Resource ID | Match, document or other application resource in a declared namespace | A discovery secret alone |
| Service ID/endpoint | Replaceable bootstrap, relay, replica or gateway description | Player identity, record authority or guaranteed availability |
| Session generation | One attempt/connection lifetime with cancellation and authority fences | Persistent person or resource identity |

Preserve existing Versus `hv1` identities and existing signature domains. A new shared implementation must not re-encode, re-sign or reinterpret archived records. Versioned adapters can support legacy messages explicitly.

Applications may initially keep separate persistent identities. Linking them requires an explicit authenticated binding/delegation through the appropriate Hapa identity owner. Do not copy root secrets, merge identities by name, or regenerate keys to repair a network failure.

## 4. Small proposed interfaces

These signatures describe responsibilities, not existing callable APIs or a mandated language package:

```ts
connect({ appId, resourceId, protocolVersion, expectedPeer, invitation, signal })
  -> Promise<AuthenticatedSession>

session.openChannel({ name, version, resourceId, capability, limits })
  -> AuthorizedChannel

openWriterLog({ resourceId, writerBinding, schemaVersion, limits })
  -> WriterLog
writerLog.append({ operationId, payload }) -> DurableReceipt | PendingReceipt
subscribeRecords({ resourceId, allowedFeeds, checkpoint, admit }) -> Subscription

publishPresence({ session, resourceId, kind, value, ttl }) -> void
fetchBlob({ assetRef, admittedSources, limits, signal }) -> VerifiedBlob
exportDiagnostics({ scope, redactionPolicy }) -> DiagnosticReport
```

Inject identity/signing, storage, provider policy and application admission. Generic transport code must not import game rules or document projection logic. The host retains secrets; the renderer receives only typed scoped operations and public results.

## 5. Namespaces, handshake and authorization

Discovery topics, channels, invitations and signed messages must bind the application namespace, resource, protocol version and intended role. Different applications/resources must not accept each other's invitation or control frames merely because both use the same networking library.

Before application data admission, verify a fresh handshake bound to both connection endpoints and the applicable session context. Validate subject-to-transport authorization and expected peer identity. A future adapter must provide an explicit authenticated channel-binding contract; a URL or raw stream is not an identity proof.

The application owns resource permissions. A room-discovery secret locates a room; possession alone does not define writer membership. An authenticated manifest/grant must bind resource, authority, admitted subjects, allowed writer-core keys, roles and applicable membership epoch/cutoff.

Define bearer versus recipient-bound invitation behavior, expiry and replay policy. Cached contact information may help dial a peer but cannot revive an expired invitation, challenge, table reservation or membership grant.

A replica may serve another subject's valid history without being authorized to act as that subject. Admit explicit feed/resource bindings; never grant arbitrary Corestore replication from connection success alone.

## 6. Provider policy and append-only adoption

Describe services with stable ID, role, adapter/version, overlay/network scope, endpoints or public keys, actual provenance and applicable expiry/retirement state. Keep declaration, local adoption, reachability observation and retention evidence distinct.

Bundled public bootstrap defaults have build/upstream-source provenance unless an operator declaration was actually verified. Do not invent operator signatures. An arbitrary signed advertisement is not automatic local adoption or authorization to contact arbitrary URLs/private services.

Accepted service changes must be recoverable append-only decisions with a deterministic effective projection. Invalid/unavailable updates retain the last completed valid policy, subject to already accepted expiry, disable and retirement decisions.

### Atomic import and restart

Treat a multi-record configuration import as a logical transaction. Record an import ID/digest, base revision, ordered entries or equivalent bounds, and a completion marker/verified final digest. A digest seen on one partial entry does not mean the import completed.

After interruption, resume missing entries idempotently or leave the incomplete batch unapplied. Do not silently activate a partial replacement, skip its remaining retirement/mode records, or duplicate already committed decisions. Preserve partial history as evidence; do not truncate it to hide the interruption.

### Disable, retirement and fallback

Disabled services require an explicit enable decision before reuse. A retired service identity cannot be resurrected by startup seeding, default fallback, a repeated import or a cached successful connection. Re-adoption, when supported, requires an explicit new authorized decision with documented identity/provenance semantics.

An accidental invalid empty replacement may preserve the previous valid policy. It must not restore hard-coded defaults that the previous valid policy retired. If no eligible route remains, report that state honestly and preserve data while offering a deliberate recovery action.

Default/extend/replace/isolated modes must have explicit semantics. Several bootstrap providers share discovery only when they participate in the same compatible overlay. An isolated development network is named explicitly; different overlays do not automatically bridge.

### Relay attempts and feedback

Provider arrays must drive actual candidate selection. Associate each relay key with its own endpoint/provenance. Record bounded attempt outcomes and cooldown/failure feedback. A previously successful preferred relay that subsequently fails must not indefinitely hide other eligible candidates.

A relay being configured, selected or dialed is not evidence that it forwarded a connection. Report observed direct/relayed paths only when supported; otherwise report unknown. Controlled native tests qualify fallback behavior, not public-service availability or all NAT combinations.

## 7. Contact evidence, conflicts and freshness

Keep signed contact snapshots and verified core checkpoints as distinct evidence objects. Each records its own subject/core binding, schema/revision and semantic descriptor digest; a verified core checkpoint additionally identifies its actually verified position/fork/head.

Receiving a newer signed snapshot does not upgrade an older core checkpoint. The current descriptor's proof level remains snapshot-only until the matching history is verified. Retain the older checkpoint separately without labeling the newer state core-verified.

At the same subject/core/revision, disagreeing comparable descriptor content is a conflict regardless of arrival order. A later core fetch must not silently overwrite an accepted conflicting snapshot, and the reverse order must detect the same conflict. The schema defines comparable payloads or descriptor hashes; timestamps alone do not decide truth.

Reject known rollback, inconsistent core bindings and unexpected history replacement. Preserve conflict evidence and the last unconflicted accepted state. Do not keep dialing a route already retired by accepted policy. A newer signature is not a blanket permission to discard a conflicting checkpoint.

Maintain an independent entry path: bundled accepted discovery policy, cached verified contact data/known peers or a signed invitation. A feed cannot explain its own fallback if every way to retrieve it is unavailable.

A first-contact or disconnected client cannot prove that no unseen revocation exists. State freshness as last verified locally; expiry bounds use without establishing global latest state. Root-key succession and transport-key rotation are separate operations.

## 8. Durable records and application admission

Records must bind schema/version, resource, writer identity/feed and an operation/revision identity sufficient for deduplication and provenance. Bound frame sizes, writer/feed counts, buffered bytes, pending requests, replay work and supported formats.

Use explicit application admission before exposing remote effects. Cryptographic verification proves the authenticated record origin/history; it does not prove a legal move, graph invariant, membership grant or truthful score.

Separate local intent, durable append acknowledgment and remote replication observation. A timeout can leave an operation pending/unknown; reconcile by stable operation ID before retrying. Do not acknowledge durability solely because the renderer changed, and do not duplicate an uncertain append.

Keep replicated history in actual core records rather than local-only metadata. Define unexpected fork/truncation handling, verified checkpoints and storage limits. Reaching a limit must produce a recoverable explicit condition, not silently skip later history or reset identity.

A projection/checkpoint is rebuildable only from the retained inputs and declared schema/version/cut. Retain the needed writer-feed positions and permission state. Wall-clock arrival order is not a sufficient historical ordering or revocation rule.

## 9. Connection lifetime and host boundary

Each connect/join attempt has a stable ID, generation, visible stage, bounded deadline and cancellation outcome. Host and runtime deadlines must agree about whether work is active, pending, cancelled, failed or committed.

Late callbacks from cancelled/retired generations cannot allocate a second authority, mutate a new session or resurrect a reservation. A durable action that completed before cancellation must be reconciled through its application protocol rather than hidden as a simple cancelled request.

Provider changes must preserve root keys, writer logs, resource identities and committed decisions. Apply changes at safe connection boundaries. Recreating a native transport, when required, must restore the existing application authority rather than create another one.

Native host adapters may use supervised Node, Electron or another qualified runtime. A browser bridge must bind to loopback, enforce exact origin and session capability, and expose bounded typed operations. Loopback alone is not authorization. Portable offline exports must not contain native session capabilities or auto-grant arbitrary file/null-origin access.

Transport adapters must state framing, authentication/channel binding, backpressure, cancellation and error semantics. Protomux requires a message-preserving framed stream; another transport needs an appropriate adapter rather than an assumed drop-in substitution.

## 10. Presence and application-specific state

Presence is ephemeral: cursors, drag previews, availability and editing indicators use bounded schemas, rate/coalescing rules and expiry. Bind the claimed author to the authenticated session or verified forwarded origin. A client cannot claim another identity merely by supplying its ID.

Presence expiry means no recent observation; it does not prove departure, concession, revocation or loss of durable data. Do not append every pointer movement or heartbeat to permanent history.

The game adapter owns deterministic rules, seat commitments, agreement and result evidence. The collaborative-document adapter owns merge behavior, local undo, ordering, deletion and graph projection. Do not require either application to interpret the other's payload semantics.

For a Yjs adapter, create a fresh Y.Doc client ID for each editing session; do not persist/reuse it as a cryptographic user identity. Tag local/import/remote origins to avoid reappending received updates as new local authorship. Selective undo should target the user's own intended transactions.

Yjs convergence applies to peers receiving the same accepted updates. It does not provide authentication or arbitrary fine-grained ACLs. Validate authenticated envelopes, decode defensively and define deterministic projection/recovery behavior. Avoid dropping updates merely because one arrival order produces a temporarily incomplete graph; verify convergence across supported arrival orders.

## 11. Assets, retention and portability

An asset reference must include a content digest with algorithm, byte length/type and one or more concrete storage locators. A Hyperblobs locator includes its core key and byte/block bounds; those bounds are not themselves a content hash.

Validate bounds and verify bytes before declaring an asset available. Separate metadata-known, source-reachable, downloading, verified-local and retained-copy states. A referenced URL/core is not proof that bytes are already retained or permitted to render.

Availability requires an online holder; durability requires retained copies/backups and a defined policy. Signed history does not keep machines online or prevent local block clearing. Replication and retention receipts must describe the actual scope observed.

Historical replay needs retained operation inputs, permission cuts and necessary assets. Snapshot/compaction/garbage-collection policies must preserve claimed replay scope or explicitly narrow it. Export must declare missing assets instead of reporting a self-contained artifact that omits them.

## 12. Diagnostics, evidence and Hapa primitive mapping

Expose app/build/protocol identity, connection stage/attempt, compatibility, provider provenance and observable outcome through a shared diagnostic vocabulary. Redact secrets, private endpoints/paths and full invitation payloads. Distinguish a diagnostic receipt from deliberately exported public application evidence.

Evidence levels remain explicit: source inspection, controlled model/native fixture, installed package, independent machines/networks and human acceptance. A declaration, mock or local tab exchange cannot satisfy a live WAN claim. The case catalog records requirements until an implementation attaches actual execution evidence.

Map this contract to a proposed Hapa Protocol Card with input/output schemas, capability scope, persistence/retention rules, implementation version/digest and conformance evidence. Provider descriptions, local adoption, runtime measurements and reward/entitlement remain separate records. Register through the appropriate existing owner when implemented; no registration or Card identifier is asserted here.

## 13. Primary references

- [HyperDHT](https://github.com/holepunchto/hyperdht): discovery/bootstrap and keyed native connections.
- [Hypercore](https://github.com/holepunchto/hypercore): authenticated logs, replication, local metadata and fork/truncation capabilities.
- [Protomux](https://github.com/holepunchto/protomux): framed streams and protocol/id channels.
- [Hyperblobs](https://github.com/holepunchto/hyperblobs): blob storage bounds, reads and clearing.
- [Yjs updates](https://docs.yjs.dev/api/document-updates): commutative/idempotent updates and state-vector synchronization.
- [Y.Doc](https://docs.yjs.dev/api/y.doc): session client IDs, transactions and garbage collection.
- [Selective undo](https://docs.yjs.dev/api/undo-manager): transaction origins and undo grouping.
- [Awareness](https://docs.yjs.dev/api/about-awareness): ephemeral presence protocol.

The library references support the stated primitives. Interface, policy, ownership and rollout choices above are review-selected application design, not claims that the libraries implement all of this contract automatically.
