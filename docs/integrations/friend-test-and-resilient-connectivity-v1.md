# Hapa Versus — Friend test and resilient connectivity v1

**Date:** 26 November 2026, America/Los_Angeles.  
**Status:** Selected implementation direction under [Addendum 09](../requirements/2026-11-26-human-feedback-addendum-09.md); no new runtime or release claim.  
**Inspected repository:** `1ca6228880fa9d17499ae90b1190bb9d92f6ada9`. Reconcile newer local work before implementing.  
**Handoff:** [Assignment 19](../reviews/2026-11-26-next-agent-assignment-19.md), after reconciling [Assignment 18](../reviews/2026-11-26-next-agent-assignment-18.md).

## 1. The acceptance target

CJ and one friend, each on their own machine and internet connection, open compatible bundled apps, discover/challenge each other or exchange an in-app invitation, play one human-versus-human game, and retain the same verified result. The friend follows a short player journey and performs no developer or network administration.

The repo link is a valid handoff only when its player entry leads to the appropriate runnable download. A successful contributor build is useful separate evidence. The friend journey does not depend on anonymous source-build closure, a browser bridge, an always-online archive, or a server operated by CJ.

Keep the installed app independent of Harbor, Avatar Builder, Music Library, Harness, paid models and CJ-specific paths. Package approved runtime/assets; preserve the expected local default and R18-01. An authenticated remote human must never be represented as Red's bot controller or silently replaced by a bot when a connection fails.

## 2. Baseline findings that change the next work

These are source observations at the inspected commit, not claims about newer local work.

| Source | Existing behavior / gap | Required direction |
| --- | --- | --- |
| `identity.js`; `runtime.js::_transportKeyPair` | Persistent `hv1` player identity and separately generated persistent transport key | Retain both; never regenerate identity as connection repair. |
| `runtime.js::parseInvite`, `joinTable`; `lobby.js::dial` | Signed `hvinv1` capsule binds player, transport, network and challenge; dial uses `joinPeer` | Use this path for the earliest WAN attempt; retain v1 reading when adding contact snapshots. |
| `desktop/main.mjs::networkConfig` | Reads relay/archive lists, selects `relays[0]`, returns no bootstrap configuration | Implement typed config and real candidate selection; adding a field must affect the running native stack. |
| `desktop/peer-host.mjs` | Forwards relay/archive options but no bootstrap | Carry the accepted effective policy through the full host/runtime boundary. |
| `runtime.js::joinLobby`; `lobby.js::start` | Runtime already accepts bootstrap options; a single relay key is captured by its callback | Reuse the existing runtime; inspect pinned APIs before designing safe fallback/reconnection. |
| `lobby.js::start` | Marks state online when discovery `flushed()` resolves | Distinguish local discovery progress from proof that the intended peer is reachable/authenticated. |
| `main.mjs::callPeer`; `runtime.js::joinTable` | Default host call deadline is 20 seconds; join can wait 30 seconds for authentication plus 15 seconds for table retrieval | Expose a coherent attempt lifecycle; prevent a late successful join after UI failure from creating duplicate/ambiguous sessions. |
| `package.json`; Forge/runbook | macOS arm64 build path; no normal downloaded cross-machine launch established in reviewed evidence | Choose the friend's real platform, qualify exact artifact and normal OS handling. |
| Response 16/17; Review 18 | Same-Mac native/public-DHT evidence; remaining known correctness faults | Reuse valid evidence, close applicable faults, and separately establish real two-network human evidence. |

Pinned source links: [main](../../desktop/main.mjs), [utility host](../../desktop/peer-host.mjs), [runtime](../../src/hapa/network/runtime.js), [lobby](../../src/hapa/network/lobby.js), [identity](../../src/hapa/network/identity.js), [control signatures](../../src/hapa/network/control.js). The file links follow the containing checkout; the inspected commit above identifies this observation.

## 3. The player journey

1. Download the matching app from the repository's player entry or open the artifact CJ sends. Install/open using the normal supported OS flow. No terminal/security-bypass instructions count as this target.
2. Open to a working representative game surface. Create identity automatically in stable OS userData; optionally choose a display name. Base local play remains available without internet.
3. Choose **Play online**. The app starts its peer runtime and discovery automatically using bundled defaults. Show compact progress and a clear Ready-to-challenge state when justified; do not require provider setup.
4. Find the friend's name/fingerprint and Challenge/Accept. Keep **Open a table / Copy invitation / Join by invitation** readily available when roster discovery is incomplete. Copy/paste is sufficient; a custom URL handler is optional.
5. Confirm compatibility before starting: network namespace, protocol, executable profile/rules/content and intended identities. Seat assignment and setup remain automatic after the ordinary game acceptance.
6. Play using each person's own inputs and one Ready per commitment. Connection loss shows recovery; it is not concession. Preserve R18's ambiguity and reservation protections.
7. Finish through a legal outcome or deliberate human concession under the existing game rules; record which occurred. Both see matching verified result evidence saved locally. An unavailable archive leaves a truthful pending-share state and does not block completion.
8. Quit/reopen normally; identity and result history remain. A later game can start without deleting user data.

Normal screens should say what the player can do next. Bootstrap hostnames, relay keys, protocol debugging and host ownership belong in diagnostics/advanced support, not mandatory onboarding. Do not make the first friend session a fault-injection exercise; the agent qualifies known recovery faults beforehand.

## 4. Infrastructure roles and initial defaults

| Role | Responsibility | Identity/authority boundary |
| --- | --- | --- |
| HyperDHT bootstrap provider | Entry into a particular compatible DHT overlay | Does not define player identity, game outcomes or retained history. |
| DHT discovery/rendezvous | Find live peers for a topic or transport key and assist connection establishment | Discovery is not proof of a successful authenticated match connection. |
| Native blind relay | Carry encrypted live streams when direct establishment needs help | Does not retain match/contact history or adjudicate the game. |
| Contact/history replica or mirror | Retain and serve verifiable records | Hosting a player's records does not authorize playing as that player. |
| Directory/archive | Assist presence/result retrieval and retain public evidence | Receivers still verify evidence; cached presence is not a global roster. |
| Future browser/alternate transport gateway | Adapt a specifically implemented transport | Requires its own adapter and authentication/channel-binding contract. |

Start with the existing HyperDHT public defaults. Upstream documents these standalone bootstrap entries:

```text
88.99.3.86@node1.hyperdht.org:49737
142.93.90.113@node2.hyperdht.org:49737
138.68.147.8@node3.hyperdht.org:49737
```

The prefix is an IP hint, not a public key. Published defaults are source evidence, not a live availability certificate. The local coding agent must measure actual startup/connectivity on the candidate. The public website answering HTTP does not prove DHT UDP connectivity. No openly usable traffic-relay key has been qualified for this milestone.

Third-party machines/VPSs can supply compatible services without becoming permanent dependencies. Several bootstrap providers must join the same overlay to share discovery. Separate isolated DHTs need explicit participation/advertisement in each; changing an address does not bridge networks. Several hosts using one blocked protocol do not provide transport diversity.

## 5. Small extensibility boundary to implement now

### Typed provider records and local adoption

Define a versioned service descriptor with stable service ID, role, adapter/protocol version, network/overlay scope, endpoints or native public key, source/provenance, and applicable revision/expiry/retirement fields. The precise schema is implementation work; document it and bound its size.

Distinguish these statements:

- An operator's signed service declaration, where one actually exists.
- The application's bundled default, traceable to a pinned upstream source/build.
- A local user's explicit adoption/disable/retirement decision.
- An observed reachability result with time and method.

The public bootstrap defaults do not come with verified operator-signed descriptors. Record their real provenance; do not invent operator signatures. An arbitrary peer's signed service advertisement does not grant local trust or permission to contact an arbitrary URL.

Maintain accepted service add/update/disable/retire decisions as append-only Hypercore records. A local service-policy history can remain separate from the publicly shareable contact log. Bundled configuration seeds that history; a validated projection determines the effective runtime policy. Migrate existing valid `userData/network.json` additions without losing provenance, duplicating imports on every launch, or rewriting older history. Retain the last verified usable policy when an update is invalid or unavailable; retirement/expiry already accepted by the client still applies.

Record provider/configuration changes, not every heartbeat or transient IP. Diagnostics and ephemeral health observations have bounded retention. Do not broadcast private endpoint configuration, owner grants or support logs in the contact feed.

### Configuration must reach the runtime

Carry accepted bootstrap candidates, relay candidates and role-specific options through:

`bundled/local accepted policy -> Electron main -> utility host -> PeerRuntime -> Lobby/Hyperswarm`

Define default/extend/replace semantics explicitly. Normal startup inherits the public defaults. Adding a compatible provider should extend the usable set; an accidental empty override must not silently create an isolated network. An explicitly isolated development overlay is a separately named mode.

Apply provider changes at safe connection boundaries. A changed policy must not reset player keys, reservations, match IDs, committed decisions or native journals. Do not tear down a healthy match just because an optional descriptor was refreshed. If pinned library limitations require recreating a swarm, fence old generations and restore the existing authenticated session rather than inventing a second authority.

### Real route selection and bounded attempts

Use a small resolver/adapter boundary around the existing native path. It accepts the expected player, verified contact hints, local provider policy and a cancellable attempt context; it returns an authenticated candidate connection or a stage-specific failure.

Inspect the installed Hyperswarm/HyperDHT APIs before choosing callback/retry behavior. Implement bounded attempts across eligible native relay/service candidates, retry/backoff, duplicate-connection handling and retirement of stale attempts. A configured first relay failing must not permanently hide a reachable second compatible relay. Candidate-specific keys/endpoints stay associated; do not flatten unrelated provider metadata into one ambiguous list.

The session owns a stable attempt ID/generation with visible stages: starting discovery, finding/dialing friend, authenticating, negotiating table, connected, recovering, cancelled or failed. Align host and runtime deadlines. Timeout/cancel must fence late completion and reconcile any durable reservation; Retry must not repeat an uncertain mutation. Reuse the R18 operation-recovery work.

Only implemented adapter types are executable. Unknown future types are retained as data where appropriate and reported unsupported, never fetched/executed blindly. Bound counts, sizes, timeouts and concurrent attempts; keep owner APIs and secrets outside the network configuration contract. An HTTPS descriptor mirror is not itself a game-stream adapter.

## 6. Signed contact history and survivable identity

Keep current `hv1:<root-public-key>` identity. Introduce one persistent single-writer contact Hypercore, explicitly bound to that identity. Do not derive or replace root identity from a hostname, relay account, public IP, installation directory or transport key.

| Value | Purpose |
| --- | --- |
| Player/root key | Authority for player bindings and contact updates. |
| Contact-core key | Authenticated history to retrieve; distinct from a transport address. |
| Core discovery key | Topic for peers sharing that core; not a read/verification key. |
| Transport key | Dialable native endpoint, authorized by the player. |
| Provider ID/key/endpoint | Replaceable assistance service. |

Append identity-authorized contact records containing schema version, subject, contact-core binding, sequence/previous-record linkage, stable transport bindings, approved public record sources, route/service references, and retirement/expiry policy. Reuse canonical encoding and a dedicated signature domain. A current descriptor is a projection of the authenticated history, not a mutable unproven profile counter.

Add a versioned invitation carrying the existing table/network/expiry binding plus contact-core key and a compact signed current-contact snapshot. Continue reading `hvinv1`; do not silently reinterpret existing signatures or archived match protocols. The snapshot gives an initial dial path even when the contact core cannot yet be fetched. Test truncation, tampering, expiry and unsupported formats without leaking storage or creating a reservation.

Contact-record freshness and game-invitation expiry are separate. Cached contact information may help dial/authenticate the same player, but must never extend or revive an expired invitation, challenge or table reservation. Starting a game still requires a currently valid offer.

On successful authentication, exchange/replicate only the permitted contact records, verify their root binding, and cache the last accepted descriptor and core checkpoint. A signed snapshot authorizes its content; it is not proof that a referenced Hypercore checkpoint was actually retrieved and verified. Record those evidence states separately. A known contact can use cached information or seek replicas on the contact discovery topic. A namespaced `hv1 -> contact-core` lookup topic can be added when needed; bare player IDs do not currently resolve themselves. A reachable announcer is still necessary.

Keep existing fresh identity authentication bound to the native connection. A mirror may return a valid descriptor but cannot impersonate its author. Transport-key rotation can preserve `hv1`; replacing the root key requires a separately defined succession/recovery mechanism. Preserve/back up the root and contact writer now; do not introduce a general DID method, shared write secret across devices or Autobase identity system for this iteration.

### Bootstrap, append-only policy and freshness

- Preserve at least one outside entry path: bundled DHT configuration, cached verified records/known peers or a signed invitation. Storing all fallback routes only in an unreachable feed cannot initiate recovery.
- Write contact history as replicated Hypercore blocks, not local-only `userData` metadata. Explicitly enforce the application's no-unexpected-truncation/fork policy and keep verified checkpoints/conflict evidence; underlying Hypercore capabilities do not define application acceptance.
- Reject rollback below a client's accepted consistent history. An old valid signature alone cannot prove that no newer revocation exists. Label freshness as locally last verified; expiry bounds use without claiming global latest state.
- Retain both players' match evidence and appropriate contact copies. Independent replicas and backups improve availability; if every holder is offline, a new observer cannot fetch the record. Offline third-observer service remains separately qualified.

## 7. Package and distribution contract

Use the selected Electron/Forge shell and narrow IPC. Bundle the built game, exact engine/runtime closure and notices, required native modules/resources, rules/catalog/decks, fonts and approved starter presentation. Verify native storage/network loading inside the packaged utility process, with no system Node or local checkout available.

Persist identity, contact/service history and matches under stable OS userData outside the application. Replacing the app keeps those stores. Development fixtures must not point at real player data.

Current scripts target macOS arm64. Obtain the friend's actual OS/architecture; build and exercise that specific target if different. Do not infer Windows/Intel/Linux support from Electron's general capabilities. Signing/notarization and observed OS prompts belong to the exact artifact; normal download/open is an acceptance gate. Do not satisfy it by removing quarantine, disabling protection or changing the delivery channel merely to evade the check.

The selected inclusion of the necessary engine is already authorized at the product level. Preserve the exact approved distribution boundary, notices and private history. If a particular asset/grant/signing credential remains unavailable, finish independent work and show the precise artifact/content list and missing input. Do not call a local unsigned package a friend-ready release.

Provide a release record with source/engine/profile/protocol fingerprints, OS/architecture, filename, byte size, SHA-256, signing/notarization status and actual artifact URL/location. The repo's player Download link must resolve to that matching artifact. Keep contributor commands separately, and report public source-build accessibility independently.

## 8. Diagnostics and evidence

Implement in-app Copy connection report / Export diagnostics. Include build/platform, network namespace, compatibility, stage/attempt IDs, bounded timestamps/errors, service configuration provenance and actual observed path. A relay being configured is not proof it carried the connection. Use direct/relayed only when supported by observation, otherwise unknown.

Exclude signing keys, tokens, private owner endpoints, full filesystem paths, raw IPs and full invitation payloads. Use short fingerprints for support metadata; deliberate replay export is separate and carries the public game evidence necessary for verification. The friend should be able to send useful diagnostics without a terminal or automatic upload to a third party.

| Acceptance | Required witness |
| --- | --- |
| FT-01 Artifact | Correct selected OS/architecture, exact manifest/checksum and normal downloaded install/open. |
| FT-02 Clean runtime | No developer tools/owner services; board works; real native core append/reopen and networking start/stop in the package. |
| FT-03 Connect | Two independent machines/networks, compatible builds, challenge or signed invitation, both authenticated human seats. |
| FT-04 Play/result | One complete game, one Ready per commitment, matching verified terminal evidence and local history on both. |
| FT-05 Persistence | Ordinary quit/reopen retains player/contact identity and history; next game does not need deletion/reset. |
| FT-06 Recovery | Agent-qualified relevant R18 cuts; reconnect/late attempt cannot duplicate committed input, seat reservation or result. |
| FT-07 Bootstrap policy | Accepted extension reaches actual native options; startup works with one unavailable entry and another working entry in the same overlay. |
| FT-08 Service fallback | With direct path deliberately unavailable and first compatible relay failing, a second reachable configured relay actually carries an authenticated session; preserve identity/session evidence. Controlled native fixture is acceptable evidence for this seam, labelled as such. |
| FT-09 Contact trust | Contact restart/replication, transport update with stable root, cached snapshot initial dial, invalid binding/known rollback/fork rejection. Do not claim unseen-revocation detection. |
| FT-10 Delivery | Brief friend instructions, reachable artifact pointer and redacted in-app diagnostics. Human outcome is recorded only after the humans run it. |

Run the first WAN attempt with existing invitations as soon as dependencies permit; it need not wait for the contact extension. Complete the extension as part of Assignment 19. Do not substitute two processes, a single LAN, a VPN, bots or mocked sockets for FT-03/04. Such probes remain useful, separately labelled engineering evidence. Native controlled relay tests prove adapter/fallback wiring, not a public provider SLA or universal NAT coverage.

Keep three explicit statuses: **candidate prepared**, **ready for the friend to try** (package and applicable agent gates qualified, human session pending), and **friend test passed** (observed two-network human result). Full parent-milestone completion and public-release/CJ acceptance remain separate.

## 9. Evidence-directed escalation and deferred scope

If the actual networks fail, diagnose discovery, dialing/NAT, authentication, compatibility or game setup before selecting infrastructure. Use an available authorized compatible third-party/community relay if appropriate; do not purchase or deploy a CJ-maintained VPS as an automatic fix. Full UDP blocking may require a different adapter, and must be reported accurately. A hotspot/control experiment diagnoses a network difference but does not pass the original home-network requirement.

Preserve selected parent browser online, Rematch, broader directory/profile and offline archive work with explicit status. Future WSS/WebRTC adapters, several independent overlays, operator-managed service feeds, root recovery/delegation and a formal DID method are extensions; avoid implementing a general platform before this friend journey fits.

## 10. Primary references and limits

- [HyperDHT README](https://github.com/holepunchto/hyperdht/blob/main/README.md): public bootstrap defaults, override semantics and keyed connections. [Pinned constants v6.37.0](https://github.com/holepunchto/hyperdht/blob/v6.37.0/lib/constants.js) were inspected in the preceding infrastructure review.
- [HyperDHT connection guide](https://docs.pears.com/p2p/how-to/connect-to-peers/connect-two-peers-by-key-with-hyperdht/): direct establishment limits; no default traffic relaying.
- [Native blind relay guide](https://docs.pears.com/p2p/how-to/connect-to-peers/relay-connections-through-a-blind-relay/): live encrypted forwarding and operator responsibility. Pear CLI behavior is not automatically installed in Hapa's Electron runtime.
- [Hypercore reference](https://docs.pears.com/p2p/reference/building-blocks/hypercore/): keys/discovery, replication, local metadata and fork/truncation capabilities.
- [W3C DID Core](https://www.w3.org/TR/did/): service endpoints require defined identity/resolution semantics; this proposal does not claim an existing Hapa DID standard.
- [Response 16](../reviews/2026-11-25-p2p-implementation-response-16.md), [Response 17](../reviews/2026-11-26-three-pass-implementation-response-17.md), [Review 18](../reviews/2026-11-26-readiness-review-18.md): repository evidence and unresolved gates.

Research/source inspection establishes the architecture and known defaults. This publication performs no live external DHT/relay qualification, new installed-app test or remote-human match.
