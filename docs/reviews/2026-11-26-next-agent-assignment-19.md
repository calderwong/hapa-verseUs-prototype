# Assignment 19 — A friend opens the app and plays across town

**26 November 2026 · selected next iteration for the local Hapa coding agent**

## Outcome

Prepare the exact app CJ can send to a friend on another machine/internet connection. The friend opens it, uses the in-app lobby/challenge or invitation, and plays CJ. Both retain the same verified result. No developer setup, router work, provider configuration or VPS maintained by CJ is required for the initial attempt.

Implement the minimum durable connectivity extension as part of this iteration: identity-bound Hypercore contact history, verified cached invitations, append-only service adoption/history, and real selection of replaceable compatible providers. Start with native Hyperswarm/HyperDHT; additional transport adapters remain explicit extensions.

Authority: [Addendum 09](../requirements/2026-11-26-human-feedback-addendum-09.md). Working contract and acceptance IDs: [Friend test and resilient connectivity v1](../integrations/friend-test-and-resilient-connectivity-v1.md). Existing game rules and archived record meanings remain unchanged.

## Reconcile once before editing

1. Read `AGENTS.md`, the local Hapa grounding/start files it names, and the current `origin/main:docs/reviews/README.md`. Use [Loose Screws](../workflows/LOOSE_SCREWS.md).
2. Inspect branch/worktrees/status, recent local commits, current handoff and the real Overwatch `hapa-versus` state. This assignment was prepared against `1ca6228880fa9d17499ae90b1190bb9d92f6ada9`; newer local fixes may exist. Fetch and integrate notes without resetting, cleaning or overwriting that work.
3. Reconcile the in-flight [Assignment 18](2026-11-26-next-agent-assignment-18.md) and [Review 18](2026-11-26-readiness-review-18.md). Preserve completed fixes; supply concise evidence for already-fixed findings. Keep remaining parent browser/Rematch/directory/archive work visible, with its current status.
4. Identify the actual candidate, profile/protocol/engine and installed entry point. Resolve the friend's OS/architecture from available context. It is not known in this handoff; continue independent implementation while obtaining that artifact-selection fact. Current build scripts establish macOS arm64 only.

Do not interrupt a coherent in-flight fix to restart the project. This is the queued next delivery target, with current user direction governing its narrower native friend-test acceptance. An existing A18 local-playtest recommendation and this WAN deliverable are separate claims.

## Task groups

### N19-01 — Finish the candidate and package the real player path

- Close applicable R18 decision, setup/reservation, host lifetime, terminal proof and result-truth defects before handing known faults to the friend. Preserve expected mesh/Red restoration and the selected presentation scope; do not impersonate the remote human with Red or a bot.
- Package required Electron/native modules, engine closure/notices, rules/content and approved assets. Prove the packaged utility process creates/appends/reopens a real Hypercore and starts networking without system Node, a source checkout or optional owners.
- Keep identity/matches/new contact and service stores under stable OS userData, outside the app and test fixtures. App replacement must preserve them.
- Parameterize build selection as needed and qualify the friend's actual target. Normal downloaded install/open is the gate; report signing/notarization and observed OS prompts honestly. Do not use quarantine removal or disabling protection as the acceptance path.
- Put an obvious player download/install entry in the README when a real artifact exists. Keep source setup separately. The existing product decision to bundle required runtime is authorization; prepare any genuinely unresolved file/grant/credential boundary before asking about it.

Acceptance: FT-01/02/05/10. Preserve the earlier public source-build requirement as separately tracked work; do not claim it is solved merely because an installer exists.

### N19-02 — Make online connection a normal in-app flow

- Play online starts discovery automatically with shared public defaults. Names are optional presentation over persistent identities. Display useful progress, compatibility and failure reasons.
- Keep Challenge/Accept and Open table/Copy invitation/Join by invitation accessible. The friend never edits network JSON, pastes relay keys, opens ports or launches a server.
- Introduce a stable connection-attempt lifecycle with bounded cancellation/retry and generation fencing. Resolve the inspected 20-second host call versus up-to-45-second runtime join mismatch. Reconcile late success or an uncertain reservation once; do not replay a mutation or allocate two seats.
- Discovery flush is a stage, not proof of the intended peer's connection. Preserve direct/relayed/unknown truth. Archive absence must not block game completion or local verified results.
- Add in-app redacted Copy connection report / Export diagnostics, with build/platform, compatibility, stage/attempt and error information; exclude keys, tokens, raw addresses/private paths and full invitations. Keep signed replay export distinct.

Acceptance: FT-03/04/06/10 and the relevant A18 ambiguity/recovery cases. The first friend session is one uncomplicated human game; agent fault qualification happens beforehand.

### N19-03 — Wire replaceable native providers end to end

- Define typed role/version/network-scoped service records and effective local adoption policy. Separate bootstrap, native relay, replica/archive and future gateway roles.
- Carry bootstrap and relay candidate configuration through desktop main -> utility host -> PeerRuntime -> Lobby. At the inspected baseline bootstrap settings stop before the runtime and only `relays[0]` is used. Fix actual plumbing and selection, not only schema fields.
- Keep public HyperDHT defaults working without configuration. Define default/extend/replace and explicitly isolated-development modes. Multiple providers in the same overlay are interchangeable entry services; arbitrary separate DHTs do not automatically interoperate.
- Append accepted add/update/disable/retire decisions to Hypercore history, including actual provenance. Migrate existing local configuration idempotently; retain last verified usable policy on a failed update. A peer advertisement does not automatically become trusted configuration.
- Implement bounded native candidate fallback/cooldown and duplicate-connection fencing using the installed APIs. Preserve player keys, session IDs, reservations and journals. Apply changes safely without tearing down healthy games.

Acceptance: FT-07/08, using a real controlled native fallback witness where needed. Same-host provider fixtures establish wiring only; no public relay or all-NAT claim follows. No new paid host or deployment is required to complete this code.

### N19-04 — Add portable signed contact history

- Keep current root `hv1` identity and separate transport key. Open one persistent single-writer contact Hypercore with an explicit root-signed binding and a dedicated signature domain.
- Append durable transport/route add/retire changes; derive the current supported route set. Preserve record-source versus game-connection distinctions and local policy versus public metadata.
- Add a versioned signed invitation containing the existing challenge/network/expiry semantics plus contact-core key and compact signed snapshot. Retain `hvinv1` decoding and archived signatures. Set and test practical payload/route bounds.
- Verify and cache contact records/checkpoints; replicate only admitted records. A signed snapshot is not itself proof that a referenced Hypercore checkpoint was fetched/verified. Use bundled defaults, verified cache or invitation as an initial entry path rather than requiring an unreachable feed to explain its own fallback.
- Reject forged bindings, known rollback, unexpected forks and retired routes. Preserve fresh connection-bound player authentication. Expiry and last-verified state must not claim knowledge of unseen revocations.
- Wrap current native dialing in a small resolver/adapter boundary; unsupported future adapters remain explicit. Do not add a general DID platform, root recovery system or multiwriter identity database to deliver this iteration.

Acceptance: FT-09, including restart, transport change with stable player identity and an initial dial from a cached signed capsule. Keep contact/service metadata out of local-only Hypercore userData when it is meant to replicate.

### N19-05 — Fit, qualify and prepare the friend handoff

Use the earliest working native invitation path for the first available real-network experiment; it need not wait for N19-04. Complete N19-03/04 before calling the whole assignment implemented. Assemble related changes and use focused attachment checks; do not launch a full regression or packaging cycle after every edit.

When the candidate fits, run the required `npm run check`, then exercise the changed connected browser workflow and actual installed/native journey to the extent changed. Reuse valid evidence. Qualify known faults with agent-controlled cases; do not delegate first-pass debugging to the friend.

Produce:

- Exact artifact filename, platform/architecture, byte size and SHA-256; source/engine/profile/protocol manifest; signing/notarization and actual delivery/download location.
- A short friend-facing instruction sheet: download/open, Play online, Challenge/Accept or invitation, play, where to report a problem. No setup commands or infrastructure decisions.
- A two-network evidence form with machine/platform/build, independently connected network descriptions, discovery/invitation route, observed connection path, authenticated player fingerprints, game completion/result hashes and quit/reopen outcome. Omit private raw network details.
- A concise implementation response with N19/FT dispositions, A18 reconciliation and the exact remaining external inputs. Record **candidate prepared**, **ready for the friend to try**, and **friend test passed** separately. Human evidence remains pending until CJ/friend actually run it.

If CJ and the friend are not available during agent execution, finish and publish the prepared implementation/candidate/evidence and mark FT-03/04 human execution pending. Do not simulate their acceptance or stop early while independent work remains. If their actual networks fail, diagnose the failing stage and qualify an already available compatible provider or propose the concrete remaining adapter/service need; do not automatically rent a VPS or quietly substitute a hotspot for their target network.

## Handoff and scope preservation

Publish one dated **Implementation response 19** using the report template, update current pointers and the stable player runbook, and read back the pushed source/report and any published artifact metadata. Reconcile the linked GitHub task in the actual local Overwatch workflow and append progress/evidence; CJ accepts Done. Do not invent board commands or claim a board update from this documentation publication.

Retain separate status for broader selected browser online, direct Rematch, live directory/profile and offline-third-observer/archive work. Provider extensibility does not prove every network connects; signed provenance does not provide always-online storage. Paid services, unfamiliar assets or platform credentials are genuine external inputs only when a precise prepared boundary requires them.

Stop after the coherent implementation/delivery handoff or an explicit remaining external dependency once independent selected work is complete. No repeated permission is needed for the already selected implementation. This task does not authorize purchasing infrastructure or changing private repository visibility.
