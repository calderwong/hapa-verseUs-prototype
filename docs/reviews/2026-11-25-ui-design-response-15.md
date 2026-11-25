# Implementation response 15 — 2026-11-25

## Scope and source

- **Goal and scope:** Assignment 15's two bounded corrections.
  - **R14-01:** reconcile the panel composition when the available space changes, including Parties & Cards.
  - **R14-02:** release HitFX's per-board textures even after its effects expire.
  - The closed transport work, the repaired compact-panel behavior, ownership-aware teardown and the delivered Home composition are preserved. No scenery polish or new feature.
- **Review addressed:** [Review 14](2026-11-25-ui-design-review-14.md) and [Assignment 15](2026-11-25-next-agent-assignment-15.md), with the [Review 14 evidence](evidence/2026-11-25/review-14/README.md), published in `2e5bfb0`. They review implementation `153b657` at main `3fc3f1b`.
- **Reconciliation:**
  - The working tree was clean on `main` at `3fc3f1b` (Response 14, on GitHub).
  - I fast-forwarded to `2e5bfb0`. There were no local commits or uncommitted work, and no other agent's work in this checkout.
- **Implementation:** commit `da76b0bb04ab7b8b6af6b25e6a0a8aafcf387b42` (tree `9f685277d03222a6783781a7f86e968877f55ecd`), parent `2e5bfb0`. This documentation and evidence follow in the next commit. The implementation tree was clean when committed.
- **Changed files (SHA-256):**
  - `src/hapa/presentation/app.js`: `92c11255e4f0894b8263e71adc28a07186a12b3167044f22ae08dd4b7142d13f`
  - `src/hapa/presentation/fx.js`: `86a6a1f16ec8bf204f3d361730f5878600a58c8252f3d6a05f786bb0e27a28c6`
  - `src/hapa/presentation/board-view.js`: `23ede152f74f12c4c1e4369815c8507d8f58b7876a1c35926815aa20849c7ea5`
  - Every other source file is byte-identical to `153b657`. That includes the soundtrack, deck, table, scenery and resources modules, so Response 14's transport evidence and the reviewer's reruns still apply.
- **Running identity:** the existing Vite server on `127.0.0.1:5199` serves the working tree from disk. The live journey ran on exactly the source committed as `da76b0b`, with no edits after it.
- **Engine gitlink:** `vendor/lumina` stays at `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged. Profile `hapa_open_10x9_v3_07`.
- **Owners:** unchanged and clean. Song Registry `dadb049`, Harbor `1ab09d9`, Harness `16dc700`.
- **Overwatch:** new card HV-66 in Review, successor to HV-65. Creation receipt `evt_1795650507647_d5b3b4fe`. The handoff comment follows this documentation commit.
- **CJ acceptance:** not recorded.

## R14-01: the layout reconciles when space changes

`App._reconcilePanels(preferred)` replaces the open-only rule.

- **When it runs:**
  - directly, when Orders, Music, the conversation or Parties & Cards is deliberately opened;
  - once, coalesced to the next frame, when `_syncFreeSpace` sees the world's size or a fixed reservation actually change. The fixed reservations are the navigator and a required decision; a `ResizeObserver` on the world feeds this.
  - It never runs per frame because a face or label moves.
- **What it keeps.** The open panels are ranked by the player's most recent deliberate use, and kept greedily while the board keeps a usable band (220 px). The most recent panel always survives. The rest collapse quietly, each with its own state:
  - Orders: tab and scroll;
  - Music: tab, filter and list scroll;
  - conversation: draft, selection and history scroll;
  - the navigator: list scroll.
- **Focus and decisions.** Focus moves to the surviving panel only when it was inside a panel that collapsed. A required decision counts as reserved space and is never dismissed.
- **Navigator reservation.** Opening Parties & Cards now reconciles, and both opening and closing it refresh the free band immediately. That closes the stale reservation the review identified.
- **Unchanged:** desktop coexistence and the closed deck's face-clear placement. The deck and the open drawer still size from the same free band (`Table._placeDeck` and `_freeSpace` use the same arithmetic as in Response 14).

## R14-02: HitFX releases its own textures

`HitFX.dispose()` is idempotent. It disposes the parts of any effect still running (materials, non-sprite geometries, label maps) and the three reusable textures (`burst`, `rune`, `arrow`) once. It then clears its references and detaches its group; a second call returns `null`.

`BoardView.dispose()` calls it before collecting the scene. The effect cache is therefore released even when no effect sprite is attached, and nothing it already released is collected again. Shared module caches, three's shared Sprite quad and owner-managed subtrees are untouched. `BoardView.dispose()` now also reports `fx: { items, textures }`.

## Focused proofs

### Helper lifecycle (R14-02)

[Probe](evidence/2026-11-25/response-15/helper-lifecycle-probe.mjs) and [result](evidence/2026-11-25/response-15/helper-lifecycle-result.json). The probe is derived from Review 14's expired-effect probe with the same fixtures. It keeps its own handles to the three textures, because the corrected helper clears its references. The reviewer's original probe reads `effects.tex.burst` after disposal, so against this source it now stops at that read; its published baseline result is left as it was.

| Case | Before teardown | First BoardView disposal | Texture dispose calls | Second disposal |
| --- | --- | --- | --- | --- |
| A: effect expired | 0 items, 0 children (14 sprites had referenced `burst`) | `fx: { items: 0, textures: 3 }` | burst 1, rune 1, arrow 1 | `null` (board and helper) |
| B: effect still running | 1 item, 16 children | `fx: { items: 1, textures: 3 }`; every running part's material disposed once | burst 1, rune 1, arrow 1 | `null` |

The shared Sprite quad received 0 dispose calls, and the probe's `pass` is true.

**Restart witness:** after one real Ready whose resolution rendered two Supply effects (0 items left after expiry), three match replacements each released `fx: { items: 0, textures: 3 }`.

| | GPU geometries | GPU textures | Programs |
| --- | --- | --- | --- |
| Before replacement (Tick 2 board) | 1286 | 129 | 41 |
| Replacement 1 | 1276 | 120 | 40 |
| Replacement 2 | 1276 | 120 | 40 |
| Replacement 3 | 1277 | 121 | 41 |

This is a short witness, not a benchmark. Response 14's fresh-match series stands, with Review 14's qualification that it predates the effect-cache case.

### Layout transition journey (R14-01)

[Record](evidence/2026-11-25/response-15/layout-transition-journey.json). These are real pointer and keyboard actions; "hit" means `document.elementFromPoint` at the control's center returned the control itself.

1. **Desktop (1440×900).** Play, Orders → History, Music → Kept, filter `lantern`. Both stay open: Music at x 572–1012, Orders at 1027–1427.
2. **Narrow to 700×900, with no other action.** Orders collapsed and kept History. Music (the most recent panel) stayed open with Kept and `lantern`, spanning 247–687.
   - Pause (292–328) hit itself, and so did Previous and both row Play buttons (x 264–321).
   - Review 14's baseline: both panels stayed open, with Music squeezed to 13–272.
3. **Open Parties & Cards with Music open.** The navigator spans 13–313, Music collapsed, and free-l is 315 px. The closed deck is right of Red's face (407–687).
   - Previous, Play, Next, Keep and Music each hit themselves.
   - Review 14's baseline: Pause was covered, and its center hit the navigator.
4. **Close the navigator, then reopen Music.** free-l returns to 0. Music reopens on Kept with `lantern`, focus on the Music button, and Play and the row Play buttons hit themselves.
5. **Pause, then Play,** by real clicks on the open drawer: paused, then playing.
6. **Conversation and Music switching.** I typed `Playtest draft` without sending it. Opening Music collapsed the conversation, with Kept and `lantern` kept. Reopening the conversation collapsed Music; the draft was intact and the input had focus. I then cleared the draft without sending.
7. **Back to 1440×900.** The navigator, the conversation and Music all stay open together, so desktop coexistence is retained.

| Capture | Shows |
| --- | --- |
| [01](evidence/2026-11-25/response-15/01-desktop-orders-and-music-coexist.jpg) | Desktop: Orders (History) and Music (Kept, `lantern`) side by side |
| [02](evidence/2026-11-25/response-15/02-narrowed-700-music-kept-orders-collapsed.jpg) | After narrowing: Music kept with its state, Orders collapsed, transport and rows reachable |
| [03](evidence/2026-11-25/response-15/03-700-parties-open-deck-reachable.jpg) | Parties & Cards open: Music collapsed to the face-clear deck, all transport reachable |
| [04](evidence/2026-11-25/response-15/04-700-conversation-draft-kept.jpg) | The conversation reopened with its unsent draft after a Music round trip |
| [05](evidence/2026-11-25/response-15/05-desktop-parties-music-conversation-coexist.jpg) | Desktop: navigator, conversation and Music coexisting |

## Verification record

- **Helper lifecycle:** the probe passes (exit 0).
- **Layout transition journey:** as above.
- **Integrated:** `npm run check` on the committed tree: exit 0, 158/158 tests, bot-versus-bot smoke match, two-process peer-verified match and build ([summary](evidence/2026-11-25/response-15/npm-check-summary.txt)).
- **Not repeated:** transport, owner, Keep and art evidence. None of those dependencies changed.
- **Hygiene:** secret scan clean; no local absolute paths in the published files.

## Remaining limits

- **Room threshold.** It is still a working default: 220 px of board band, with panel widths from their CSS rules.
- **Decision drawer.** The required-decision case was covered by code reading only; no decision was open during the journey.
- **Hit tests are centers only.** They cover the controls named above, not every pixel of every control.
- **Viewport sizes.** Only 1440×900 and 700×900 were exercised. No device matrix.
- **Navigator focus.** Opening the navigator still focuses its first control, its close button, as before.
- **Texture counts.** One or two textures above Response 14's 119 after a played Tick fit the shared caches warming for new piece states, but were not traced individually. CPU heap was not measured.
- **Earlier limits carried forward:** response-mode comparison, the −3 cutaway and the cropped skiff are unchanged and remain disclosed.

## Decisions and next handoff

- **For CJ:** the candidate is ready for an ordinary playtest. Resize the window, open Parties & Cards, Orders, Music and Red's conversation in any order, and judge whether the table and setting feel inhabited while you play. Following the review, the art is left as delivered.
- **Overwatch:** HV-66 is in Review (creation receipt `evt_1795650507647_d5b3b4fe`). The handoff comment citing this documentation commit is appended after it lands. CJ moves cards to Done.
- **Stop:** this work item and its automatic continuation end with this handoff. No board-drain cycle or new enhancement is started.
