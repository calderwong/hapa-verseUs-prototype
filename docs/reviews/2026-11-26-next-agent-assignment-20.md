# Next agent assignment 20 — trustworthy connectivity, Windows qualification, and the friend test

**26 November 2026 · assigned to the local Hapa Versus coding agent · follows [Connectivity review 19](2026-11-26-connectivity-review-19.md) and [Response 19](2026-11-26-friend-test-implementation-response-19.md)**

## Goal and authority

CJ's target remains concrete: CJ and a friend, each on a separate normal home internet connection, open the packaged app, connect, play a game, finish, and reopen their identity/history. The friend uses a **Windows PC**; this is already answered. CJ does not need to rent or maintain a VPS to attempt this prototype.

Read `AGENTS.md`, its local Hapa grounding, current local execution state, [Addendum 09](../requirements/2026-11-26-human-feedback-addendum-09.md), [Addendum 10](../requirements/2026-11-26-human-feedback-addendum-10.md), [the friend-test companion](../integrations/friend-test-and-resilient-connectivity-v1.md), Review 19, and the new generic [Hapa connectivity v0.1 contract](../protocols/hapa-connectivity-v0.1.md) before changing behavior. Preserve current user decisions, in-flight work, native identity/journals, unsupported legacy bytes, engine pin and game semantics. Reconcile the local state with GitHub and Overwatch; do not restart work just because an older review still contains an open item.

Reviewed head: `b42f555e35f7686dd3391e4f00f64a03875b5fb5`. The reported Mac package uses source `c7a00c1`; the reported Windows package uses `fa51315`. Treat source, packaged executable, owner services and live-browser revision as separate identities.

This assignment authorizes implementation and necessary focused verification. It does not authorize purchase/deployment of paid infrastructure or changes to another project's private content. Follow existing local execution and release procedures; do not ask CJ to reconfirm Windows or previously authorized routine work.

## Priority 1 — correct the shared semantics in Versus

### N20-01 · Separate current contact state from proof, and preserve conflicts

Close R19-01 and R19-02 together, keeping signed snapshot admission, fetched core proof and live peer authentication distinct.

- Store accepted snapshot revision and verified checkpoint/revision separately. A newer signed snapshot does not inherit “core verified,” or its last-fetched timestamp, from an older revision.
- Compare equal-revision semantic state across signed snapshot and core sources. Conflicting routes must become an explicit bounded conflict, with useful retained evidence, rather than whichever arrived last silently replacing the other.
- Fence/serialize asynchronous verification commits against newer accepted state. Preserve rejection of forged roots, known rollback, unexpected core/fork change and retired routes. Do not claim knowledge of an unseen revocation.
- Retain source/proof distinctions in diagnostics without leaking full invitations, keys, addresses, paths or private history.

**Acceptance:** Matching states in both arrival orders; newer snapshot without replicated record; later valid promotion; same-revision contradictory valid signatures in both orders; stale verification completion; known rollback/truncation/fork; restart from cache. Use controlled deterministic tests for semantic admission, then a pertinent native contact replication/reopen witness. Do not equate the controlled fixture with Hypercore proof validation.

### N20-02 · Make service adoption respect retirement and survive interrupted imports

Close R19-03 and R19-04.

- Derive effective options solely from accepted eligible providers. Explicitly retired, disabled or expired entries must not reappear through `PUBLIC_BOOTSTRAP` fallback.
- Resolve an empty/invalid replacement before adoption or expose an honest bounded no-route state. Retaining a prior policy must not undo already accepted retirement or silently cross an isolated/public overlay boundary.
- Give each multi-event configuration import a completed-batch boundary. Use atomic appending or resumable import with explicit commit state as supported by the pinned storage API.
- Restart must not mark a partially appended import fully applied. Preserve idempotent completed imports, provenance and the last complete valid policy.
- Keep health observations separate from durable provider adoption decisions.

**Acceptance:** Defaults and accepted alternatives under add/disable/retire/expiry/replace/isolated; all-defaults exclusion; invalid and empty updates; actual effective options reaching Hyperswarm; interrupted import at each relevant durable boundary; identical configuration after restart; completed import reapplication. Test that no retired endpoint is attempted, rather than checking only its status label.

### N20-03 · Bound fallback after a formerly good relay fails

Close R19-05. Inspect the pinned HyperDHT/Hyperswarm behavior and available attempt/failure signals before selecting the mechanism.

- An observation that A once worked may influence priority, but may not pin every unsuccessful retry to A for ten minutes.
- Implement bounded candidate advancement/cooldown and truthful attempt/health diagnostics.
- Preserve healthy established games and duplicate-connection fencing. Separate bootstrap entry, native blind relay, archive and future browser/gateway roles.
- Do not claim a public native relay is qualified merely because public bootstrap nodes exist.

**Acceptance:** Unreachable first candidate; previously observed A subsequently unavailable with B reachable; cooldown expiry/recovery; exhausted candidates and visible bounded failure. In a controlled native fixture, prevent direct-path upgrade and witness an authenticated session actually carried by B. Report the observed path and fixture restrictions. If unable to run that fixture, retain a specific pending FT-08 gate; a selector test or normal direct connection is insufficient.

### N20-04 · Preserve cancellation intent through durable leave

Close R19-06 without weakening setup tombstones.

- Cancelling an accepted/starting join must produce terminal `cancelled`, not a generic failure emitted by reservation cleanup.
- Keep the tombstone/leave durable before release and keep late setup messages fenced.
- Ensure cancellation and retry are responsive at each exposed stage; inspect how serialized work and delayed feed creation affect the response.
- Do not convert a cancelled setup into a concession, completed match or loss.

**Acceptance:** Cancel during discovery, negotiation, accepted and starting phases; duplicate cancellation; delayed setup/worker completion; next attempt. One tombstone where required, no revived seat, correct displayed reason, no duplicate side effect.

## Priority 2 — qualify the actual delivery and retain the inherited boundaries

### N20-05 · Run the Windows artifact before calling the friend candidate ready

The previous Windows ZIP is built/inspected but has never run on Windows. Cross-compilation, PE/ASAR inspection and bundled DLL presence do not close FT-01/FT-02.

Use a Windows x64 machine or VM to download the actual intended release artifact and exercise the normal extraction/open path:

1. Record artifact URL/name, SHA-256, source/build identity, Windows version/architecture and distribution/signing status.
2. Observe and accurately document actual SmartScreen/firewall behavior. Do not promise that Windows will present exactly one prompt or that a particular network profile always suffices.
3. Open without Node, npm, terminal, developer server or manual configuration. Confirm packaged assets, native modules, utility peer readiness and in-app progress/error handling.
4. Create identity, close and reopen, and verify identity/journal continuity in the intended OS user-data location.
5. Complete the pertinent invitation/join/cancel flow against a second candidate, confirm the build/compatibility identity and retain redacted diagnostics.

If no Windows runner is available, state the exact unavailable resource and keep Windows runtime qualification pending. Finish all other authorized code/evidence work first; do not ask the friend to silently substitute for this known missing agent-side gate.

When code changes affect the package, build the candidate from an identified source, run the mandated final implementation gate, and qualify the resulting bytes. Do not label the older released ZIP as tested by exercising a newer dev build.

### N20-06 · Stage the specific A18 cuts needed for the next claim

Response 19 already records A18 implementation. Credit it and complete missing qualification at the affected boundaries; do not blanket-report those fixes as absent.

Use a small explicit matrix mapping each inherited finding to current source, applicable installed/native cut and result. Prioritize the boundaries touched by the new iteration and those necessary for the promised ready candidate:

- Delayed Ready append and reconciliation of late durable commitment.
- Lost STARTED / interrupted accepted setup and safe durable leave.
- Late/never-ready utility worker retirement/replacement with stale generation fencing.
- Local terminal/closing before remote closing is present, plus delayed counterpart evidence retrieval after ordinary retirement and restart.
- Result/archive disagreement and failure states with truthful own-seat versus jointly verified outcomes.
- Identified default Avatar and installed owner rendering; representative selected scene/motion capture set for the separate visual-readiness claim.

These are not a demand to repeat every old suite for each small change. Record a cut as passing only when its decisive boundary was exercised. An automated same-host native result and a human internet result are different evidence.

### N20-07 · Identify the expected default Avatar before claiming visual restoration

Pinned source intentionally uses Harbor's `red-pose-art 2026-11-02.1` on a seated transparent plane. The latest unversioned browser observation shows that performer present; it is not a volumetric mesh witness. The former empty chair was the owner-unavailable fallback.

Inspect the existing local Mesh Avatar/Harbor package and prior approved user reference to identify the intended default renderer/mode. Preserve owner provenance, one performer/audio owner, retry/epoch fencing and neutral remote-human identity. Demonstrate default Home, close/orbit, owner unavailable/recovered in the same match, and the installed delivery path. If the unresolved item is genuinely CJ's desired appearance, bring the concrete identified options and evidence after investigation. Do not ask an abstract “which avatar?” question before doing that work, invent an unapproved replacement, or copy a private owner store into the installer.

### N20-08 · Run and record the real two-network friend target

After pertinent code and artifact qualification, provide the short player path and conduct the target with CJ and the friend:

- Each person opens the identified packaged app on their own machine and normal home internet.
- In-app discovery or the simple invitation path connects them; no terminal, port-forwarding, service URL entry or VPS administration is required from the friend.
- Both human controllers play; complete a game, compare the relevant verified result, close/reopen and retain identity/history.
- Record both artifact/build IDs, OS/architecture, coarse network distinction, observed path where knowable, stage/timing, result identity and redacted diagnostics.
- If it fails, preserve the stage and evidence; diagnose bootstrap/discovery, transport reachability, authentication, compatibility or setup before recommending infrastructure.
- A hotspot/LAN/same-host retry may help diagnose but does not pass the original two-home-network acceptance.

Use the existing evidence form. “Candidate prepared,” “Windows smoke passed,” “forced relay passed,” “friend test passed,” “broader QE passed,” and “CJ accepted” remain separate statuses. Record only the ones actually achieved.

## Shared foundation responsibility

Versus is the first implementation owner for the native provider policy, signed contact/checkpoint rules and bounded connection-attempt primitives. Work from the generic contract and conformance catalog shared across the Hapa ecosystem. Preserve application namespaces, authority, capabilities and data retention boundaries.

Stabilize the semantics above before extracting a small reusable core. Keep UI/game rules and match lifecycle out of it; chart document synchronization and browser transport stay in their owning application/adapter. Do not copy the whole Versus runtime into another app or claim cross-app interoperability merely because both use Hypercore. Provide fixtures and a versioned contract that another implementation can satisfy. Any extraction needs actual consumers and conformance evidence, not a new package hierarchy alone.

## Deliverables and stop condition

Publish an implementation response 20 with:

- Addressed finding IDs, concrete behavior changes and exact commits.
- Focused semantic/native/installed results with commands, fixture scope and relevant redacted evidence.
- A source → artifact → executed-machine mapping for each delivered package.
- Updated readiness statuses, remaining blockers, and the actual two-network result when performed.
- The shared contract/conformance changes and which behavior remains application-specific.
- Accurate review/README pointers; friend platform is already Windows. Retain historical reviews and append the new response rather than rewriting prior evidence into a pass.

Follow the repository's mandatory final implementation check, with no vendor/engine drift. Do not continue broad optional testing after the remaining acceptance risk is resolved. Do not end at “tests pass” while the intended executable or connected target remains unqualified; state the exact external block after completing all work possible in the environment. CJ retains acceptance authority.

