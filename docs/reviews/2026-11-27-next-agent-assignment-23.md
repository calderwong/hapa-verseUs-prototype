# Assignment 23 — finish reconnect and provider-use correctness

**27 November 2026 · follows [Review 21](2026-11-27-lifecycle-and-delivery-review-21.md) at `d0be02d0e4a7b6f6132ce499bf0d45d82b30327f`**

## Goal and starting point

Finish the remaining concrete lifecycle/provider boundaries in the bundled friend experience. The known pair is CJ on Mac and a friend on Windows, each on a separate home connection. They should open matching apps, connect by challenge/invitation, play, and reopen with their identities/results. No terminal, provider JSON, owner app or operated VPS belongs in the friend's normal flow.

Read AGENTS, the current review index, Response 22, Review 21 and its evidence. Compare current GitHub/local work with the pinned head before changing anything; preserve newer work. Credit the delivered original cancel fix, bootstrap/relay expiry, honest relay selection, installed Red journey and hard Windows gate. Do not reimplement them wholesale.

Use Loose Screws: focused checks while assembling related changes, one final integrated qualification, then a coherent handoff. The review is authorization to continue the requested reversible implementation, not a new approval checkpoint.

## N23-01 — one activation boundary through reconnect (P1)

- Fix V21-01: `_resendStart` must not first-activate an authority that is still opening or belongs to a tombstoned/cancelled attempt. Use one explicit activation owner/state across initial send, reconnect resend, late callbacks and persisted recovery.
- Preserve legitimate retransmission for an already activated session and lost-STARTED recovery. Post-activation Cancel must still explain Leave; pre-activation cancel must release without a synthetic game loss.
- Regression: hold native match initialization; reconnect before cancel and after cancel; deliver any emitted messages to the counterpart; release initialization and restart. No opened counterpart or STARTED for a cancelled generation, no resource leak, one tombstone; a fresh attempt succeeds. Retain existing accepted-cancel and lost-STARTED controls.

## N23-02 — current provider use and cache identity (P2/P3, same focused batch)

- Fix V21-02: reconcile configured archive eligibility whenever a new operation might dial/query/submit to it. Do not keep startup-adopted archives forever after expiry/retirement. Distinguish explicit/manual archives and already healthy transports from newly selected configured services.
- The default packaged configuration has no archive providers. Correct the extension contract without adding an archive service or making archive availability a human-game prerequisite.
- Preserve retained records, signing identity and append-only decision history. Time passing must not invent a new adoption event. Do not tear down a healthy game merely because a bootstrap expires.
- Fix V21-03 within the dynamic relay component: same id with changed key/endpoint must use the new bytes and correctly scope endpoint-specific confirmation/cooldown state. No live provider editor is required.
- Regress expired archive at later join/result operation and same-id relay key replacement; retain no-route/bootstrap/relay controls. Document how disabled/retired/expired/manual sources are resolved.

## N23-03 — qualify relay carriage with a valid control

HC-09 remains partial. Stop treating selector activity as carriage. Read Review 21's pinned HyperDHT OPEN/direct hypothesis and the existing failed namespace logs.

1. Reduce to two peers and one live relay. Instrument both negotiated firewall classifications and direct/relay branch choices with redacted pairing correlation.
2. Establish a topology or supported fixture that genuinely reaches both sides of the relay negotiation while preventing direct carriage. Prove an authenticated payload stream through that relay.
3. Add dead preferred → live alternative, concurrent requests and exhaustion; verify identity unchanged and measured attribution.
4. If the control remains blocked, report the exact observable cause/remaining hypothesis and the smallest next experiment. Do not repeat an unchanged failed topology or introduce a paid/operated service to conceal the uncertainty.

This qualifies fallback. The direct-route exploratory human test may be reported separately with its actual limits.

## N23-04 — integrated release and truthful handoff

- Run the affected source/native tests as the fixes are assembled. At final integration run `npm run check`, then the changed native reconnect/cancel journey and packaged startup/invitation/result/reopen journey on the actual candidate.
- Use the established Windows workflow against the released zip; missing/failed reports must fail. Preserve two-launch identities, OS data placement, late/never-ready and matching results. Known Windows platform must not become an open question again.
- Reuse unchanged Red evidence; repeat it only if rendering/owner/delivery dependencies changed. Preserve Red's supported default, one performer, same-match owner recovery and honest 2D mesh/pose-art naming. Screenshots alone do not qualify animation performance.
- Record source SHA, clean/dirty state, page/build/protocol/profile identities, artifact bytes/SHA-256 and workflow/result references. Qualify HC-06/HC-10 by the exact boundary exercised; do not turn a subset pass into a blanket guarantee.
- Reconcile README current goal/download/source, review index, integration checkpoint/runbook and player sheet together. Preserve historical reports. Add `2026-11-27-implementation-response-23.md` (use the actual later date if appropriate), mapping N23/V21 to fixes, evidence or a precise remaining dependency.
- Keep platform execution, ordinary consumer downloaded launch, two-home human play, independent review and CJ acceptance separate. Do not claim a two-network run without two networks. For the private owner stores, retain allowlisted delivery; no store sweep or secret publication.

## Optional Assignment 21 remains queued

Keep Mimi/Falka, Leo and Thor selected. Response 22 found owner rigs for Falka/Leo/Thor but no served route and no confirmed Mimi alias. Resolve real owner identity/routes first; preserve three separate controls (roster, chosen seat, opted-in online availability), two seats and controller/performer separation. Do dependency-ready local roster work without making it a human friend-test gate. Do not fabricate owner ids or an answer to Mimi/Falka.

## Shared architecture boundary

Keep the mirrored connectivity contract/catalog unchanged unless a coordinated versioned change is necessary. Prefer a small common conformance evidence envelope and app adapters before extracting runtime code. Keep game rules and authority here; provider changes must not reset identities or reinterpret archives. No new CJ-operated VPS, framework rewrite or broad SDK prerequisite.

Update an already configured local board if accessible under the existing workflow, with actual evidence; never claim a board update that was not made. Finish with the candidate and remaining concrete human/external test, rather than another unbounded internal review cycle.
