# Implementation response 24 — connection readiness, one Avatar choice, exact relay reports

**27 November 2026 · coding agent (Claude Code) · answers [Review 22](2026-11-27-runtime-and-roster-review-22.md) / [Assignment 24](2026-11-27-next-agent-assignment-24.md) · GitHub task [#6](https://github.com/calderwong/hapa-verseUs-prototype/issues/6)**

## Separate statuses

| Claim | Status |
| --- | --- |
| Candidate prepared | **Yes** — friend.7, clean source `7efa3b9`, Mac arm64 and Windows x64. |
| Windows launch (VM) | **Passed** on Windows Server 2025 x64 (GitHub-hosted) against the released zip, gated: run [46118198321](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46118198321) (job 140896628072), 6 required reports, 0 failures. |
| Consumer Windows download/prompts | **Not observed** (a CI download carries no Mark-of-the-Web; SmartScreen/firewall prompts are a human-machine observation). |
| Relay carriage (HC-09) | Unchanged from Response 23: witnessed in the controlled randomized-NAT fixture (run 46101799012), reused; native exhaustion still unproven (unit evidence only). |
| Real two-person, two-home game | **Pending** — CJ (Mac) and the friend (Windows). Not performed. |
| Assignment 21 optional players | **Partial** — the local roster scaffold and its selection are delivered; Mimi/Falka, Leo and Thor presentations, their owner routes and online hosting are not. |
| Independent review / CJ acceptance | Not claimed. |

**Stop condition.** With this batch the candidate is technically ready for the human two-home test, which has not happened. The internal repair cycle stops here; the next decision comes from that test (below).

## Candidate identity

| Item | Value |
| --- | --- |
| Source | `7efa3b9050cc4061e521c1e202da14b65ab35e9c` (build-info `dirty: false` on both platforms; release target is this commit), on reviewed head `164aa5d` / review publication `53aae50` |
| Engine / profile | `ba838cca09ba43afceda0452b63d28df4cbf7f72` (unchanged) / `hapa_open_10x9_v3_07` (unchanged) |
| Protocols | online v2, lobby v1, `hvinv2` (v1 read), contact v1, services v1 / policy v1 — unchanged; no wire change (attachment readiness is local) |
| Windows | `Hapa-Versus-0.1.0-friend7-Windows-x64.zip` · 167,159,425 B · SHA-256 `f66b0573bfc062ed0ab61b3c7ed60f12d099c261d66c5cc889cef88f06194124` · portable zip, not code-signed |
| Mac | `Hapa-Versus-0.1.0-friend7-macOS-AppleSilicon.dmg` · 124,510,751 B · SHA-256 `1a43211cddac857783d0994f709ec173146c1ff4d152f97e2e7bc9b3a605467b` · ad-hoc signed, not notarized |
| Download | [friend.7 pre-release](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.7) (README *Download and play*); `SHA256SUMS.txt` attached |

## N24 / V22 → changes

| ID | Change | Commit | Verification |
| --- | --- | --- | --- |
| **N24-01 / V22-01** authenticated attachment during initialization | `OnlineMatch` has an explicit replication readiness boundary (`feedsReady`, set once both feeds exist and the authority is not closed). `attach()` declines with `'deferred'` before it, never half-attaches, attaches a given connection at most once, and reports `connected` only after both feeds replicate. `_onConnection` (fresh authentication **and** standby promotion — the same callback) counts only real attachments. At readiness `_openMatch` attaches the connection that is current *then* and still live; it attaches nothing if the authority closed or the attempt's cancel fence / tombstone holds (found while writing the test: a Cancel during initialization still let the opener attach before the fence ran — now closed). STARTED activation stays its own owner and is **not** used to gate replication, so finishing authorities keep replicating for result recovery. | `7efa3b9` | Native test *V22-01 / N24-01* (`connectivity.test.js`): the joiner's real `OnlineMatch.open()` is held **after its own feed is ready and before the remote feed exists** (the reviewed boundary); the live connection is destroyed and Lobby re-authenticates a new one, invoking `onPeer('joined')` then `onConnection` itself. (1) Then Cancel: no exception, attach `deferred`, connection stays `waiting`, after release nothing attaches, `abandoned_setup`, one tombstone, no STARTED, counterpart opened nothing. (2) Fresh attempt with the same held re-authentication, then release: exactly one attachment, to the connection current at readiness (the one declined while opening), both feeds have replication peers, a reconnect retransmits STARTED, and play continues to a recorded result with the same commitment on both sides. **Sabotage:** with the old `attach`, the test fails with the reviewer's `TypeError: Cannot read properties of undefined (reading 'replicate')`. Controls retained and passing: V20-A, V21-01, HC-10, and the finishing-authority restart/result witnesses in `recovery-native.test.js`. |
| **N24-02 / V22-02** one Avatar choice | The older top checkbox is gone. "No figure" is the first option of the same *Play this game* radio group, so playing without a figure stays explicit. Every choice goes through `selectAvatar(id, roster)`; setup open, reopen and Start reconcile a stored choice with `resolveChoice`, which turns an ineligible choice into **no figure with the reason** — never another figure. Taking the chosen Avatar out of the roster selects No figure. Rows show name, aliases, species and a short status; owner, package, revision, renderer and alias source sit under **Details**. Clean state is unchanged: Red in the roster and chosen. Optional figures stay disabled ("not served to Versus yet"); *Available online* stays disabled. Roster edits only write the local preference — no networking, model call or match. | `7efa3b9` | `tests/hapa/roster.test.js` (the reviewer's sequence: Red out of roster → choosing Red rejected → contradictory stored state reconciled on reopen and at Start → Red selectable again; no-figure; unserved figures rejected even when in the roster, Red not substituted). **Fresh UI journey** (Vite dev page, in-app browser): clean state shows Red chosen and others disabled ([capture](evidence/2026-11-27/response-24/setup-1-clean-red-default.jpg)); unchecking Red's *In my roster* by click selected No figure and disabled Red's radio (title "Red: turn on "In my roster" first"); clicking Red's radio changed nothing; with friend.6's contradictory state planted (`avatarId: red-reaper`, Red out of roster) a reload showed No figure with "No figure selected — Red: turn on "In my roster" first." ([capture](evidence/2026-11-27/response-24/setup-2-red-out-reopened-no-figure.jpg)); **Start match** opened Tick 1 with no Avatar table ([capture](evidence/2026-11-27/response-24/setup-3-started-no-figure.jpg)); `startMatch` handed a stale Red choice played without a figure and toasted the reason; with Red back in the roster the match seated Red. |
| **N24-03 / V22-03** exact relay report set | The stage verdict moved from embedded Python to `tools/hapa/relay-witness-aggregate.mjs`: stage 1 requires exactly Peer-a and Peer-b, stage 2 Peer-a..c; each report must exist, parse, name its own peer, be unique, use the stage's mode, be ok, and list every other expected peer exactly once as relayed via `live`; extra reports, a failed topology control or too few matched pairings fail. Stale forced-relay/"currently fails" comments in the peer, script and workflow are refreshed; the old flat-firewall script is marked superseded. | `7efa3b9` | `tests/hapa/relay-witness-aggregate.test.js`: run 46101799012's committed evidence passes both stages; removing Peer-c (the reviewer's case) or Peer-b, a duplicate, a misidentified or unparseable report, `ok:false`, a direct path, a missing or doubled roster entry, a stray report in stage 1, a wrong mode, a broken control or 2 matched pairings in stage 2 each fail with a specific problem. No network experiment repeated; no relay deployed. |
| **N24-04** qualification and handoff | One integrated `npm run check`, the native lifecycle test above, the setup UI journey, friend.7 for both platforms from one clean commit, the gated Windows workflow on the released zip, Mac installed smoke and invitation journeys on the released DMG; this response, conformance record and reconciled pointers. | this commit | Below. |

## Verification levels (friend.7 bytes)

| Level | Result |
| --- | --- |
| `npm run check` on `7efa3b9` | 200/200 (195 + 5 new), two-process peer-verified match, build — [summary](evidence/2026-11-27/response-24/npm-check-summary.txt) |
| Installed Mac (macOS 26 arm64), released DMG | DMG downloaded from the release and hash-verified, app copied out of the image: 2 clean launches reporting build `7efa3b9` (dirty false), same identity, store grows ([json](evidence/2026-11-27/response-24/mac-installed-smoke.json)); two-copy invitation game over the public DHT, Tick 4 concession, matching final hash `sha256:db0a64f5…fb0c3`, both reopen with the same identities and the result recorded ([json](evidence/2026-11-27/response-24/mac-installed-invite-journey.json)); no `SecurityAgent` (keychain) prompt |
| Windows Server 2025 x64 VM | Gated run [46118198321](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46118198321) on the released zip (hash matched): two launches, isolated and under `%APPDATA%`, build `7efa3b9` (dirty false), same identity, store grows; two-copy invitation game, Tick 4 concession, matching final hash `sha256:2a292134…b43d`, reopen keeps identities and result; late worker ready on generation 2, never-ready worker bounded `failed` on generation 4 ([evidence](evidence/2026-11-27/response-24/windows-run-46118198321/)) |
| Setup UI (Vite dev page, source `7efa3b9` content) | Journey above; not the installed app |
| Independent home networks / humans | Not performed |

**Reused with their recorded scope.** Red rendering and owner outage/recovery (friend.5 installed journey, Response 22): rendering, owner and delivery paths are unchanged — the setup change only decides whether Red is seated, and the UI journey shows Red seated when chosen. Red stays a **2D mesh over pose art**. Relay carriage (Response 23, run 46101799012): networking topology and relay code are unchanged; the aggregator change is harness-only and its regression re-judges that run's evidence. The reviewer's pinned probes (`review-22/runtime`, `roster`, `relay`) verify the reviewed bytes and so refuse the changed files by design; the new tests above are this candidate's regressions.

**HC-10 boundary.** Cancel owns the cut at discovery, negotiation, after accept, during authority initialization, through reconnect (`_onPeer`) and now through the full re-authentication callback (`onConnection`) while the authority opens — these interleavings, not every possible one.

## Assignment 21 — partial, unchanged scope

Delivered: the roster scaffold (Response 23) and now a consistent single choice with Details. Not delivered: served Mimi/Falka, Leo and Thor presentations, their owner routes, and online hosting. The owner bindings stay as Response 23 reported them (Falka `avatar-8` with Mimi as a user-authorized alias, Leo `avatar-46`, Thor `avatar-39`, Mesh Avatar packages 2026-11-17.1 at status candidate); source-linked owner receipts will be attached with the actual served presentations. None of this gates human-versus-human play.

## Next: the two-home test (stop the internal cycle here)

1. CJ downloads the **Mac** DMG and the friend the **Windows** zip from the [friend.7 release](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.7), each at home on their own connection, and opens it normally ([Play with a friend](../player/play-with-a-friend.md)).
2. Both choose **Play online**; connect by **Challenge**/**Accept** or **Open a table → Copy invitation** / **Join by invitation**; play to a finish or concession; quit and reopen both apps.
3. Each fills in the [evidence form](../player/two-network-evidence-form.md) — including the Windows SmartScreen/firewall prompts and both **Copy connection report** outputs.
4. If it fails, the connection reports name the failing stage; that observed boundary chooses the next repair.

Technical review and CJ acceptance remain separate.
