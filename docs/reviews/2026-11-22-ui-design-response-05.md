# Implementation response 05 — 22–23 November 2026

**Play through the board.** This answers:
- [human-feedback addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md) (CJ's direction, HF-01 to HF-06);
- [UI and design review 04](2026-11-22-ui-design-review-04.md) (R4-01 to R4-06);
- [assignment 05](2026-11-22-next-agent-assignment-05.md);
- the three reliability findings that [review 03](2026-11-22-ui-design-review-03.md) carried forward (R3-01 to R3-03), plus its evidence-identity note (R3-05).

Response 05 was unused, so it is this one. Earlier responses are preserved unchanged. **CJ acceptance: not yet recorded.**

## Scope and source

- **CJ's goal:**
  - Replace the permanent hands, inspector and Mana panel with play on the board: hover or focus Cards and parties where they lie.
  - Strong chess identities, with destination markers at the endpoints.
  - Supply-funded destinations as a versioned policy.
  - Fire Pits feeding exact Mana basins.
  - Definitions in context.
  - Keep the review 03 repairs, then apply the Hapa treatment to the working scene.
- **Starting point:**
  - Local `main` was clean at `164b8df` (response 04).
  - The notes arrived as `a388bcf` (review 03 and assignment 04) and `67e1c80` (addendum 01, review 04, assignment 05), integrated by fast-forward.
  - There was no unpublished local work.
  - The only Codex session touching Versus (`~/.codex/sessions/2026/11/22/…05-58…`) predates response 03. No other agent was working on it.
  - On the Overwatch board, review 03 and 04 had no cards yet.
- **Commits, on top of `67e1c80`:**

  | Commit | What it delivers |
  | --- | --- |
  | `0c06ae3` | R3-01 response payment, R3-02 match ownership, R3-03 modal containment |
  | `dd9ca80` | HF-04 Supply-funded destinations as profile `hapa_open_10x9_v3_02` (rules) |
  | `fe74e10` | Contextual board: inspection controller; the panels removed; strip, Orders, navigator, decision surface |
  | `0fccfc2` | Chess standards, destination markers, the funded range in the interface |
  | `51a1b64` | Fire Pit to Mana basin, truthful projection, event-driven effects |
  | `c0899b9` | Glossary and contextual definitions |
  | `caf9e2d` | Hapa material and party treatment |
  | `238b08e` | Regression contract 2, and three interaction fixes it found |
  | `d13654a` | Keep the height-layer rail clear of inspection views |
  | `fc6df0d` | Follow-up to `d13654a`: drop the camera-pad reservation it added |

  This report and its evidence are committed separately.
- **Working tree at capture:** clean at `fc6df0d` (`report.json`: `dirty: false`).
- **Engine:** Lumina gitlink `ba838cca09ba43afceda0452b63d28df4cbf7f72`, verified as the checkout of `vendor/lumina` (its own Git work tree). Unchanged; nothing in `vendor/lumina` was edited.
- **Profile:** new matches use `hapa_open_10x9_v3_02` (rules `0.2.0`). The v3 base profile `hapa_open_10x9_v3_01` stays for golden fixtures and old replays.
- **Overwatch `hapa-versus`:** new cards HV-54 to HV-57 and evidence comments; receipts at the end.

## Outcome

1. **The board is the interface (HF-01, HF-02, R4-01).** Ordinary play is now three things:
   - a compact decision strip: seat, Tick and phase, active columns, Commander status, **Orders** with count, *changed* and *invalid* badges, the one **Ready / Acknowledge**, **Parties & Cards**, Help, sound and menu;
   - the world;
   - a thin event strip.

   Both Card ribbons, the right inspector, the Mana panel and the default roster are gone. The Home view now frames both owners' real Minor, Major and row banks, the Fire Pits and the basins. At both sizes and for both seats, every banked Card tile and both basins are on screen. The board area is:
   - **1280×720:** 1272×638 (702×424 before response 04, 946×424 after it);
   - **1600×1000:** 1590×908.
2. **One inspection system (§3, `src/hapa/presentation/inspect.js`).**
   - **States:** hover, keyboard focus, pinned and compare are separate.
   - **Hover:** opens after a 150 ms pause, follows scanning at 60 ms, and has a 250 ms exit grace. The view itself can be entered with the pointer.
   - **Placement:** views sit outward from the board centre, clear of open drawers and the height-layer rail, with a leader line to the moving world anchor.
   - **Pinning and Escape:** click, tap or Enter pins. Escape closes the top layer and suppresses that subject until the pointer leaves it.
   - **No side effects:** hover never selects, orders, moves the camera or takes focus.
   - **Suspension and reset:** inspection pauses during a Card or camera drag and resets on New match.
   - **Identity:** subjects are keyed by match generation, kind and stable instance id. A consumed or replaced Card shows as that instance's history, and a merged party names its survivor.
   - **Click containment:** a click inside a view never reaches the board behind it. This was a real bug, found by the regression run and fixed in `238b08e`.
3. **Card view (§4).** In the addendum's order:
   1. face, identity, type and owner;
   2. the actual state of this instance;
   3. exact Supply and every Mana amount, including **0**;
   4. the ability with its cost and consumption;
   5. actions;
   6. Details: instance, mint provenance, definition lineage, art attribution.

   Actions are **Load Supply into…** (any own party, with the Supply change), **Burn for …** or **Burn for 0 Mana — consumes this Card**, and **Use ability…**. Each says why when it's unavailable. A planned Card names its use and can remove that order. An opponent's Card shows the same facts with no actions.
4. **Chess identity and destination intent (HF-03, R4-03, `pieces.js`).**
   - **Standards:** authored vector glyphs, not font characters: Rook/Castle, Knight, Bishop, King, Queen, a distinct **Commander** (crown and star) and **Pawn**. Ownership is carried by value and shape, never hue alone: A is a solid ivory piece on one base bar, B a slate piece with a thin ivory edge on two. A lost Mount says **MOUNT LOST**.
   - **Scale:** standards are screen-sized at each party's logical centre (not members, colliders or pick targets). Semantic zoom with hysteresis gives 46, 40 or 36 px and quieter opacity up close.
   - **Endpoint markers:** every accepted destination (Travelling, Paused · Supply, Paused · Combat, Blocked) and every draft in either public plan (Planned, Retreat, Unfunded) shows the same glyph, hollow and dashed, at its endpoint and band. A draft replaces the accepted marker in the drawing, coincident targets fan out with a count, and hover or selection emphasises one pair. Markers never enter rules occupancy.
5. **Supply-funded destinations (HF-04, R4-02).**
   - **Rule:** a new or replacing voluntary destination (or retreat endpoint) needs the **whole remaining route** funded by held Supply plus loads **earlier** in the same plan.
   - **Quote:** one quote (`movement.quoteRoute`) measures the actual path from the present position, including finishing or backing out of an unfinished edge, and prices it with the carried fixed-point remainder.
   - **Shared:** validation, resolution, the board highlights, the uncapped Move list (with exact needs and a shortfall summary), the "if loaded: +N destinations" preview, the bot (which now emits funding loads first) and peers all use that one quote.
   - **Speed:** still the rate, so a two-step Castle route with Supply 2 takes two Ticks and arrives with 0.
   - **Removed funding:** removing a funding load keeps the dependent destination, marks it **Unfunded**, turns Ready into **Fix 1 order** (which opens Orders) and never shortens it. **Restore** puts the load back in its original place; it used to append it after the destination, a bug found and fixed in `238b08e`.
   - **Exemptions:** free pursuit and Card movement are not gated.
   - **Versioning:** the policy is in profile `hapa_open_10x9_v3_02`. Absent fields mean v3, unknown values are rejected, and the base profile, its golden fixtures and old replays are unchanged. See [docs/rules/profile-hapa_open_10x9_v3_02.md](../rules/profile-hapa_open_10x9_v3_02.md).
6. **Fire Pits and Mana basins (HF-05, R4-04, `firepit.js`).**
   - **Placement:** each owner has a carved pit and basin on the frame, outside legal territory.
   - **Counters:** sharp counters attach to each basin. "Empty" is explicit. A projection appears only as a separate *→ plan* mark, and the full named breakdown is one hover away.
   - **One command:** drag onto the pit, or the Card view's Burn, emit the same command. The opponent's pit refuses.
   - **Projection:** comes from the whole public plan in order (burns, payment burns, exact assigned spends) through `match.projectPlan`, replacing the old burns-only shortcut. During a resolution or a response window the basin shows the actual pool only.
   - **Planned burns:** rest as ghost offerings over the flame.
   - **Accepted `card_burned`:** dissolves the Card and runs **one stream per colour**. Rainbow stays Rainbow; zero Mana plays no gain.
   - **Other events:** `mana_paid` traces out of the basin, and `mana_expired` settles it.
   - **Once only:** effects play once per match and event id, counters never wait for them, reduced motion gets a static cue, and New match clears them.
   - **Timing:** events from before movement (orders, burns, Spells) now show at the start of playback instead of the end.
7. **Definitions in context (HF-06, R4-05, `glossary.js`).**
   - **Registry:** one versioned registry (`hapa-versus-glossary/1`) of 47 mechanical terms, each with aliases, a plain meaning, its source in the requirements, related terms, and current-state examples fed from rules selectors.
   - **Behavior:** terms open as true tooltips on hover or focus, close with Escape, and stay one level deep. They are used in the Card, party, basin and response views, the plans and the strip.
   - **Help:** the long teaching text moved to **Help (?)**.
8. **Review 03 reliability (`0c06ae3`).**
   - **R3-01 response payment:** availability now comes from the rules' own allocation (`economy.quotePayment`), so one Rainbow can no longer "pay" Red plus Blue. Burns are chosen only where they reduce the exact shortfall.
   - **R3-02 New match:** a match generation detaches the old pending response, playback and continuation, so late answers cannot write into the new session.
   - **R3-03 blocking sheets:** the background is inert, Tab and Shift+Tab are contained, and closing a sheet returns focus to its opener. That return was broken until `238b08e`.
9. **Hapa treatment on the working scene (`caf9e2d`).**
   - **Board:** a carved slate frame with a brass inlay, stone trays with brass lips under both owners' real banks, and plinths under the pits and basins.
   - **Characters:** a provisional Hapa party style through the native procedural painter: A slate-blue, B oxblood, ivory trim, brass accents, tabards over mail, robes for Mage and Priest, ivory capes with owner lining for Mounts. See "Asset provenance".

## Finding disposition

| Dated finding ID | What current inspection established | Change | Evidence and limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-22 / HF-01, R4-01 | Banks were excluded from the Home fit; ribbons duplicated them. | `fe74e10` | c5 (25 assertions); c6 hover on real bank tiles. Major and row Enchantment tiles exist in code and in the navigator but none was present in the tested states, so they were **not hovered in a browser**. | A fixture with a placed Major and Row Enchantment. |
| 2026-11-22 / HF-02 | Inspector was a permanent column. | `fe74e10` | c6 (party view with the real 3×3, compare, Escape order); c7 keyboard. **Not done:** comparison tabs at compact sizes (comparison sits beside the pinned view); member-body hover highlighting its slot. | |
| 2026-11-22 / HF-03, R4-03 | Small plaque; Pawns had none; only the selected route was drawn. | `0fccfc2`, `caf9e2d` | c10, c12 (standards through a full orbit, layer filtering), captures. **Not exercised in a browser:** Paused, Blocked, the coincident-target fan, Mount lost, merge and arrival marker reconciliation. Arrival removal is covered by the logic, and c10 checks the travelling markers that remain. | Fixture-driven intent states. |
| 2026-11-22 / HF-04, R4-02 | v3 allows partial-Supply destinations (as the review observed). | `dd9ca80`, `0fccfc2`, `238b08e` | `tests/hapa/funding.test.js` (8 tests: Castle 2 versus 3, Knight L at 2 versus 3, 2.5-Supply mid-edge, non-default prices against the actual debit, preceding-load rules, bot parity and replay under both profiles); c8 in the browser; peers and the smoke match on the new profile. | |
| 2026-11-22 / HF-05, R4-04 | Mana was a panel; the projection counted burns only. | `51a1b64` | c9 (offering, projection, accepted burn with 5 separate streams, zero-Mana label, `mana_expired`, New match mid-effect). **Not asserted:** the `mana_paid` trace (c2's paid counter emits it, but the effect wasn't checked). | |
| 2026-11-22 / HF-06, R4-05 | Long instructional blocks. | `c0899b9` | `tests/hapa/glossary.test.js` (coverage of the addendum's list); visible tooltip check. Glossary words are not yet attached in event explanations or the Orders list. | Wider attachment. |
| 2026-11-22 / R4-06, R3-01 | Reproduced in review 03. | `0c06ae3` | `tests/hapa/payment.test.js` (4); c2 casts a paid Blue Denial in the browser: countered, no damage, burned exactly B's 2-Blue Card, pool empty. | |
| 2026-11-22 / R3-02 | Reproduced in review 03. | `0c06ae3` | c11: New match from a pending response through the visible menu; no old choice attached; editable; replay verifies with only its own Tick. **Not tested:** New match during paused playback. | |
| 2026-11-22 / R3-03 | Source-supported risk. | `0c06ae3`, `238b08e` | c11: real Tab and Shift+Tab stay inside, the background is inert, the Ready shortcut is inert; c14: focus returns to the opener. | |
| 2026-11-22 / R3-05 | The engine field showed the outer SHA in the response-04 "before" report. | `238b08e` | The report now records `engine.gitlink` and, separately, a verified checkout. The response-04 report is preserved; its engine field for the baseline run should be read as the prototype commit, not the engine. | |
| 2026-11-22 / R3-04, UX-11, UX-12 | Flat schematic scene. | `caf9e2d` | Captures. A **provisional sample** only: no new excavation scene and no asymmetric shield/ranged party study beyond the existing recipes. | HV-50 and HV-51 remain. |

## Independent expectation and observed result

All browser checks are in `tools/hapa/ui-regress.mjs` (contract 2) and ran on the clean commit `fc6df0d`.

1. **Quiet default and Card scan.**
   - **Expected (addendum §2):** no permanent duplicates, and both owners' banks reachable at 1280×720 and 1600×1000.
   - **Observed:** the panels are absent, the navigator is closed by default, every banked tile of both owners and both basins are on screen, and Ready, Orders and the menu are in the strip, for both seats at both sizes.
   - **Result:** pass.
2. **Hover, pin and command separation.**
   - **Expected (§3):** hover never selects, orders, moves the camera or takes focus; Escape closes the top layer.
   - **Observed:** hovering B's Card opens its view in 236 ms with no selection, plan, camera or focus change. Leaving closes it after the grace period. A click pins it; hovering a party opens a comparison beside it. Escape closes the comparison first, then unpins without changing any order.
   - **Result:** pass.
3. **Party and chess reading.**
   - **Observed:** standards for every visible party at all 8 bearings of a full orbit, and the hill party hoverable at every bearing. At layer −2, only that band's standards (plus flyers) show.
   - **Not verified:** grayscale ownership, which was not re-run for the new standards.
   - **Result:** pass for these cases.
4. **Funded range.**
   - **Expected (HF-04):** Castle 2 Supply reaches two steps, not three; Knight 2 versus 3; mid-edge 2.5; non-default prices agree with the debit.
   - **Observed:** rules tests pass. In the browser, 2 Supply funds exactly R1C2, R1C3, R2C1 and R3C1. A visible unfunded target is refused with "needs 4, the party has 2". Removing the funding load leaves an **Unfunded** destination and **Fix 1 order**, and Restore re-funds it.
   - **Result:** pass.
5. **Planned resources and bot parity.**
   - **Observed:** a load must precede its destination; a later load, a load to another party, or a burned Card do not fund. In a 30-Tick bot match, every recorded bot plan validates with no refused destination, and its replay verifies.
   - **Result:** pass.
6. **Fire Pit and payments.**
   - **Observed:** see Outcome 6 and c9. The paid counter is in c2.
   - **Result:** pass, except the `mana_paid` cosmetic, which is not asserted.
7. **Non-hover input and resilience.**
   - **Observed:** keyboard-only, a few Tab stops from one step to the next: Parties & Cards (3 Tabs), C1 Castle (2), Load Supply (12), Move to R2C1 (2), Ready, result in Orders (2), Inspect the Card (2). The result matches the rules (R2C1, Supply 1, nine members). New match from a pending response works; reduced motion produces no travelling streams.
   - **Result:** pass.
8. **Compatibility.**
   - **Observed:** v3 golden fixtures and every earlier test (the 86 from response 04, plus the 4 payment tests) pass unchanged; bot-versus-bot replays verify under both profiles; the two-peer match agrees on the new profile.
   - **Result:** pass.

## Visual evidence and asset provenance

- **Browser:**
  - headless Chrome/157.0.8103.80 on Darwin 25.2.0 arm64, DPR 1, 1280×720 and 1600×1000, browser zoom 100%;
  - also played visibly in the Claude desktop app's browser pane (a real Chromium pane, not CJ's Chrome) at both sizes: hover, pin, funded Move list, endpoint marker, Fire Pit offering and burn.
- **Camera:** the fitted Home view unless stated. c12 orbits in 45° steps.
- **Before** (`dd9ca80`: the same presentation as `164b8df` plus the R3 repairs), in [evidence/2026-11-22/response-05/before](evidence/2026-11-22/response-05/before/):
  - quiet play;
  - an opponent Card in the old inspector;
  - a party in the old inspector;
  - a destination and burn planned.
- **After** (`fc6df0d`), in [evidence/2026-11-22/response-05/after](evidence/2026-11-22/response-05/after/):
  - the same four states, with hover views instead of the inspector;
  - the Fire Pit sequence: planned offering, basin projection, accepted burn with five streams, next Tick (expired).
- **Regression runs:** [regress/after-fc6df0d](evidence/2026-11-22/response-05/regress/after-fc6df0d/report.json) (219/219, exit 0) and [regress/sabotage-fc6df0d](evidence/2026-11-22/response-05/regress/sabotage-fc6df0d/report.json) (23/25, exit 1, failing exactly the two planted expectations).
- **Capture scripts:** in [scripts/](evidence/2026-11-22/response-05/scripts/).
- **Asset provenance:**
  - **Chess glyphs:** vector paths authored in `src/hapa/presentation/pieces.js`.
  - **Frame, trays and plinth stone:** painted procedurally in `boardframe.js`.
  - **Pit, basin and flame:** procedural geometry and canvas in `firepit.js`.
  - **Characters:** the native Luminati `CharacterSprites` painter at the vendored pin, with recipe changes only in `board-view.js` `spriteSpec`.
  - **Scenery:** unchanged; Luminati `TextureLibrary` and `PropFactory`.
  - **No external, AI-generated or owner media was added.**
  - **Tarot renditions:** none present locally (`public/renditions` is empty), so Card faces are procedural.
  - **Status:** the party style is a **provisional sample**. The canonical Hapa character set remains CJ's choice.
- **Performance (measured, no approved target):**
  - **Frame time:** median 16.7 ms and p95 16.7–16.8 ms at both sizes. This is headless Chrome capped at vsync (60 Hz), so it shows no regression but is not a capacity measurement.
  - **Hover-to-view:** 169–187 ms, including the deliberate 150 ms entry delay.

## Verification record

| Command or manual check | Revision / environment | Actual result | What it establishes and what remains untested |
| --- | --- | --- | --- |
| `npm run check` | `fc6df0d` (and after every commit) | exit 0; **101/101** tests; smoke match and two-peer match on the new profile (peers agree); build | Rules, replay, the funded policy, payment, playback, glossary |
| `node tools/hapa/ui-regress.mjs` | `fc6df0d`, clean, 127.0.0.1:5199 | **219/219**, exit 0; only allowed error: `/favicon.ico` 404 | c1 to c14 as described; one run per configuration |
| `… --only c1,c3 --sabotage` | `fc6df0d` | **23/25**, exit 1 | The assertions can fail |
| Visible play in the browser pane | 1280×720 and 1600×1000 | as in Outcome; issues found and fixed during play: an endpoint marker drawn at default world scale (oversized) for one frame, the Card face caught by the canvas rule, views over the field, B's standards reading too light, blank counter text | Not CJ's browser or window |
| `tools/hapa/ui-journeys.mjs` (the older recorder) | — | **not run**; its journeys target the removed ribbons and inspector | Superseded by contract 2; kept for history |

**Unverified:**
- a screen reader;
- touch and tap;
- 150% and 200% text with the new views;
- grayscale ownership of the new standards;
- the Major/row Card types, endpoint statuses other than Planned and Travelling, the coincident fan, Mount lost;
- New match during paused playback;
- first-time players.

## Decisions and next handoff

- **Design choices within the addendum:**
  - Views open outward from the board centre and stay clear of open drawers and the layer rail.
  - The Orders drawer opens itself on a stale acknowledgment and cannot be closed until you Acknowledge.
  - Ready becomes **Fix N orders** while the own plan has an invalid order.
  - A draft destination replaces the accepted endpoint in the drawing.
  - Under the new profile, the Knight debit spreads `knightRouteCost` over its three pitches (identical at baseline prices).
- **For CJ to judge:**
  - whether hover inspection is effortless at your window size;
  - whether the board reads as chess at overview distance;
  - whether funded destinations feel predictable;
  - whether the Fire Pit makes the three-way Card choice clear;
  - the provisional party palette.
- **Later:**
  - comparison tabs at compact sizes, and member-to-slot hover highlighting;
  - fixture states for the remaining marker statuses and Card types;
  - grayscale and text-scale checks of the new views;
  - glossary attachment in events and orders;
  - the finished terrain and excavation scene with an asymmetric party (HV-50, HV-51);
  - phase-independent concession (HV-53).
- **What to inspect:** `main` after this report. Open `http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=human&seed=1` and hover the banks and parties, then Load Supply and Move to…. For the Fire Pit, use `…&fixture=cards`.
- **CJ acceptance:** **not yet recorded.**

## Overwatch receipts

Board `hapa-versus`, append-only:

| Card | Events |
| --- | --- |
| HV-54 review 03 reliability | created `evt_1795421846290_4bc46946`; ready, in_progress; evidence `evt_1795421846324_8ac89889`; **review** `evt_1795421846331_0b788ac2` |
| HV-55 funded-destination profile | created `evt_1795421846336_bca2bfa2`; evidence `evt_1795421846359_12b4d875`; **review** `evt_1795421846365_a9c42d5f` |
| HV-56 play through the board | created `evt_1795421846370_8c7e0653`; evidence `evt_1795421846390_dd2ba433`; **review** `evt_1795421846394_957a6b25` |
| HV-57 follow-ups (backlog) | created `evt_1795421846400_e8732f4d` |
| HV-26, HV-48, HV-44, HV-50, HV-51 | comments `evt_1795421846406_557b2230`, `…412_840df123`, `…416_722c0e3c`, `…422_8359f5ae`, `…428_47cfc83a` |

Board state after these events: HV-54, HV-55 and HV-56 are in Review; HV-57 is in Backlog. HV-50 and HV-51 stay in Backlog with their existing gates. Cards move to Done only with CJ's acceptance.
