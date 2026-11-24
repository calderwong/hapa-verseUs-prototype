# Implementation response 08 — 23 November 2026

**One playable loop: recover a blocked formation, press Ready once, spend Mana the Tick you burn it, read members by symbol, and look at history only when you want to.** This answers [UI and design review 07](2026-11-23-ui-design-review-07.md) (R7-01–R7-06) and [assignment 08](2026-11-23-next-agent-assignment-08.md) under [human-feedback addendum 03](../requirements/2026-11-23-human-feedback-addendum-03.md). Response 08 was the next unused number. It was built under [Loose Screws](../workflows/LOOSE_SCREWS.md): assembled as one loop first, then fitted and tightened as a whole. **CJ acceptance: not yet recorded.**

## Play it

```bash
npm run dev
```

Then open **http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1** — CJ commands A, the existing heuristic bot plays B, seed 1, default profile `hapa_open_10x9_v3_03`. The same configuration is also the built-in default, so `/versus.html?autostart=1` gives it too unless a saved development preset says otherwise.

| Development mode | Link |
| --- | --- |
| CJ controls A; B is the bot (ordinary test) | `/versus.html?autostart=1&a=human&b=bot&seed=1` |
| A is the bot; CJ controls B | `/versus.html?autostart=1&a=bot&b=human&seed=1` |
| Watch both bots (Pause / Step / Stop in the match bar) | `/versus.html?autostart=1&a=bot&b=bot&seed=1` |
| Deliberate two-human hotseat | `/versus.html?autostart=1&a=human&b=human&seed=1` |
| Labelled Mana-bearing diagnostic (burn → same-Tick cast) | `/versus.html?autostart=1&fixture=response&a=human&b=bot` |

Rules for these links:

- **Precedence.** Valid URL values override the saved preset, which overrides the built-in A human / B bot, seed 1.
- **Invalid values.** An invalid role or seed is reported and replaced by the next source, so it never creates an uncontrolled seat.
- **Seeing the configuration.** Setup and the match menu (☰) show the effective configuration and a copyable launch link. The match menu can restart with other controllers; it never transfers control mid-match.
- **Keys.** **H** opens history, **P** opens this Tick's orders, **Esc** closes the top thing open.

## Scope and source

- **Starting point.**
  - Local `main` was clean at `4fd5eaf` (response 07, pushed), with no stashes, other branches, worktrees or `HANDOFF.md`.
  - `git fetch` found review 07 / addendum 03 / assignment 08 at `1c7d688`, and `git pull --ff-only` integrated them. Nothing local was at risk.
  - On Overwatch `hapa-versus`, HV-44/46/55/56/58/59 were in Review and HV-45/50/51/53/57/60 in Backlog.
- **Reproduced first.** Review 07's movement probe ran against `1c7d688` and reproduced the half-step stop exactly:
  - the Queen stopped at `(24,4)` with 5.5 Supply, `blockedTick` 6;
  - the next quantum overlaps A's Pawn R2C6 (Pikeman against Archer);
  - at Tick 13, returning to R1C6 or merging into R2C6 was accepted, quoted 1.5 and never moved, and R2C7 was "already there".

  The flow probe likewise showed two first Readies with no lock under the old agreement. Neither baseline probe was changed; both still assert the old behaviour.
- **Source commits (on `1c7d688`):**

  | Commit | What |
  | --- | --- |
  | `42b970d` | Rules and protocol: profile v3_03, reachable-segment recovery, `routeFromHere` / `routeClearance`, `travel_blocked`; own-plan agreement in `PhaseAgreement` and the peer path; bot clearance; acceptance tests |
  | `925a669` | App: agreement-driven Ready, voluntary Orders & history, dev controllers and bot scheduler, current-Tick Mana, blocked-route cues, member symbols, shared free space |
  | `bf05016` | Contract 5 browser checks; symbol size and keyboard focus |
  | `635021d` | Blocked travel named in every party state; launch notices; z12 counts the Queen's blocks |
  | `cd69ad3` | Health symbol class collision fixed; plain blocked notes |
  | *(this report)* | Response 08, evidence, index |

- **Identities.**
  - Engine gitlink: `ba838cca09ba43afceda0452b63d28df4cbf7f72`, unchanged; no engine change was needed.
  - New default profile: `hapa_open_10x9_v3_03`, revision 1, rules version `hapa-versus-rules/0.3.0`.
  - Archived profiles `hapa_open_10x9_v3_02` and the v3 base are unchanged and keep their recorded semantics.
- **Overwatch.** Evidence was appended to HV-55, HV-46, HV-56, HV-58, HV-44, HV-60 and HV-45 (receipts below). No new card was created.

## Outcome

**Implemented and verified in the stated cases. CJ acceptance is not recorded.**

1. **Movement and recovery (R7-01, HF3-01).** The half-step stop is still a real friendly-body collision; nothing was sped up or allowed to pass through bodies. What changed is reachability.
   - **Retracing.** A formation stopped between centers can always retrace its clear segment to the territory it left, or finish the segment. Both are direct destinations, and "already there" now requires actual arrival.
   - **Rerouting.** A blocked party reroutes from the node behind it, never from the obstructed node ahead.
   - **One route.** Quotes, validation, execution, the keyboard Move list, board right-click and the bot all use one function, `routeFromHere`. Debit is the real fractional distance.
   - **Naming the obstruction.** It is named once per episode (`travel_blocked`), not every quantum or Tick, and the party keeps its destination and unspent Supply.
   - **Before you order.** Every destination carries its known clearance (`routeClearance`). A route a friendly body blocks now is marked "✕ blocked by your Pawn R2C6" in the Move list and crossed on the board (shape, not only colour). Ordering it anyway gives a warning toast.
   - **After it stops.** The command bar, party hint, party box and history say "Your Pawn at R2C6 blocks its path — destination and Supply kept…", and an in-world cue marks the contact point.
   - **The bot** no longer orders routes a friendly formation physically blocks.
   - **Versioning.** This is new semantics in a new profile (`movement.recovery: reachable_segment_v1`). v3_02 replays and matches are unchanged, and the old defect still reproduces there on purpose.
2. **One Ready (R7-02, HF3-02).** Ready commits the player's own exact plan revision and hash, once.
   - **No re-acknowledgment.** The opponent may keep editing its own plan; that never asks for another click. When both own plans are committed, the exact locked pair resolves once.
   - **One implementation.** The local app now feeds this Tick's `PhaseAgreement`, the same object the peer path uses, under the profile's declared `planning.agreement`.
   - **New default policy.** Under `own_plan_ready_v1`, peers Ready their own plan at once and bind the locked pair's hashes in their Tick receipt. That receipt is a transport fact, not another human step.
   - **Legacy policy.** `pair_acknowledgment_v3` is kept for v3_02 and older. Unknown policies are refused by the profile validator, the manifest and the agreement.
   - **Duplicate input.** Repeated clicks, held Ctrl+Enter and stale callbacks are no-ops (one resolution per Tick latch plus agreement state).
   - **Responses unchanged.** Genuine response windows are as before, and an invalid plan blocks the first Ready with the specific order named.
3. **History on request (R7-02, HF3-03).** Orders became **Orders & history**, a voluntary drawer with two tabs.
   - **This Tick** shows the current drafts. **History** browses completed Ticks from `session.events`.
   - History is grouped by Tick with a one-line result ("2 arrived · 1 blocked · 5 Supply loaded"). Movement, Resources, Cards and effects, and Combat are expandable sections; each entry pins that event.
   - During playback, history shows only events already displayed. The open Tick is labelled "(open: minted so far)" and is never presented as completed.
   - Nothing opens the drawer automatically, and Close always works. A **History** button starts the event strip, and **H** toggles it.
4. **Development controllers (R7-03, HF3-04).** The existing Human / HeuristicBot seats, URL parameters and controller factory are reused.
   - **Preset.** There is one saved, validated preset (`localStorage`, per developer; when storage is unavailable the built-in default applies), with precedence as described above.
   - **Discoverable.** The effective configuration and launch link appear in setup and the match menu.
   - **Both bots.** **Pause** (the current Tick finishes, then holds), **Step** (exactly one Tick) and **Stop** own the between-Tick scheduler. New match cancels scheduled work through the timer and the generation check.
5. **Current-Tick Mana (R7-05, HF3-06).** The rules already allowed a same-Tick burn-then-cast; the presentation now says so.
   - **Burning.** A validated burn reserves its Card and immediately updates the basin's primary **Available** count with the exact colours. The Card dissolves into the pit and one stream per colour runs into the basin when the burn is planned (numbers do not wait for particles).
   - **Spending.** Queuing a cast reserves its cost at once.
   - **Undo.** Undoing a burn removes its credit. The dependent cast stays in the plan, visibly invalid, and Ready names it.
   - **Reconciliation.** At resolution the accepted burn and payment reconcile with what was already shown, so nothing is minted or animated twice. Response windows use the actual pool, and unspent Mana still expires at the Tick boundary.
   - **Zero-Mana Cards** say "0 Mana — consumes this Card" and show no colour stream.
   - **Text removed.** "Empty → plan", "Now / After plan" and "when the Tick resolves" are gone.
6. **Members by symbol (R7-04, HF3-05).** At close range every visible member is read through one small local SVG dictionary in a fixed order:
   - a role token (the Mount's actual chess glyph for a center);
   - heart and exact health;
   - channel and hits × power (a blade is Physical, a four-point spark is Magic);
   - range arrow, or melee contact;
   - a channel-marked shield, its value and a small covered-face diagram rotated to the formation's real front;
   - condition badges.

   Further rules:
   - **Shape carries meaning.** Shapes stay readable in greyscale, and the channel tints (steel, violet) never reuse the seat colours. `2×1` is never one hit of 2, and no protection is an explicit empty shield with 0.
   - **Asking a symbol.** Each symbol is a real hit area. Hovering (short dwell) or tapping shows that symbol's definition and current value — for example, "Physical protection 1 on the front face; other faces meet 0. Sources: 1 from its own shield." Escape dismisses it, and the wheel still reaches the camera.
   - **Hover versus tap.** Hovering a body only highlights it. The source breakdown opens only on a deliberate tap, click or keyboard choice.
   - **The inspection strip.**
     - It keeps identity, the command subject ("commanding your Queen R1C6"), member navigation, Return and Close.
     - When the bodies carry the facts, it no longer repeats them. When they cannot (scale, occlusion, a roof), the same symbols and values appear there.
     - Choosing a member makes its symbols a bounded set of keyboard stops, each showing the same definition.
   - **Same facts as before.** Facts still come from the displayed-moment read model, one shared registry is used, and no combat is recalculated in the UI.
7. **Drawers compose (R7-06, HF3-07).** One free-space reading covers open Orders & history, the navigator and a required decision.
   - The command bar, inspection bar, camera pad and layer rail reflow inside it.
   - The member explanation avoids those drawers too.
   - Verified journey: inspect → open history → orbit → close history → the original selection and orders remain.

## Finding disposition

| Finding | What current inspection established | Change | Evidence and limits | Follow-up |
| --- | --- | --- | --- | --- |
| 2026-11-23 / R7-01 | Reproduced exactly (probe at `1c7d688`) | Reachable-segment recovery in v3_03; shared route/clearance; `travel_blocked`; board, list, bar and history cues; bot clearance (`42b970d`, `925a669`, `635021d`, `cd69ad3`) | `tests/hapa/play-loop.test.js`; [acceptance probe](evidence/2026-11-23/response-08/acceptance-results.json) (both profiles); z12; journey clip 1 | Clearance is "known now": a formation that moves in the same Tick can still block, as B's Knight did once at Tick 3 of seed 1 |
| R7-02 | Reproduced (two first Readies, no lock) | `own_plan_ready_v1` in app and peers; legacy kept; voluntary Orders & history | play-loop tests (agreement, 8-Tick peer run); c1 (new default and legacy); z15 | Concession at any phase remains HV-53 |
| R7-03 | Confirmed: the screenshots used `a=human&b=human` | Preset, validation, launch link, Pause / Step / Stop | z13; clip 3 | — |
| R7-04 | Confirmed: labels were prose and pointer-transparent | Symbol dictionary and registry; interactive chips; strip compaction | z03, z08, z09 (44 cases incl. 150%/200% text), z10, z15; clip 1 | Icon shapes and dwell time are working defaults for CJ to judge |
| R7-05 | Confirmed: rules allowed it; UI said later | Available-this-Tick basin, immediate burn animation, reconciliation, undo, zero-Mana honesty | c9, z14; acceptance probe; clip 2 | — |
| R7-06 | Confirmed: `_avoidRects` omitted drawers | One free-space reading; CSS variables for the docked controls | z15 (open, orbit, close: nothing covered; selection and orders kept) | — |

## Independent expectation and observed result

1. **Blocked Queen and recovery** (seed 1, A human / B bot).
   - *Expected (HF3-01):*
     - the preview names the blocker;
     - travel stops halfway with 5.5 Supply and the destination kept;
     - the obstruction is named once;
     - at Tick 13 a return to R1C6 is quoted and debited 0.5, then arrives.
   - *Observed, z12 at `635021d` and `cd69ad3`:*
     - the move list says "R4C9 … ✕ blocked by your Pawn R2C6" before ordering;
     - the Queen stops at (24,4) with 5.5 Supply and R4C9 kept;
     - one `travel_blocked` by `A.pawn.C6`, and none repeated while waiting;
     - at Tick 13 the bar reads "Your Pawn at R2C6 blocks its path …" and R1C6 is listed "needs 0.5 Supply";
     - after one Ready the Queen is at (22,2), idle, with 5 Supply.

     **Pass.**
   - *Headless, both profiles* ([results](evidence/2026-11-23/response-08/acceptance-results.json)):

     | | v3_02 | v3_03 |
     | --- | --- | --- |
     | Return to R1C6 | 1.5 via R2C7, no movement | 0.5, arrives |
     | Merge into R2C6 | no movement | 1.5, merges, 4 Supply left |
     | Finish to R2C7 | "already there" | 0.5, re-blocked once |
     | Bot at Tick 13 | picks blocked routes | picks clear ones |
     | Replays | — | verify |
2. **Clear diagonal control.** A Queen or Bishop crosses one diagonal territory in one Tick for one Supply on clear ground and replays (play-loop test). **Pass**; nothing changed there.
3. **One Ready** (hotseat, default profile).
   - *Expected:* A Ready → B edits → B Ready resolves once; no drawer; spam cannot resolve twice.
   - *Observed (c1):*
     - nothing was stale and no drawer opened;
     - four further Ctrl+Enter presses still produced exactly one resolved Tick;
     - Tick 2 opened;
     - A's committed plan and B's later edit both resolved.

     Under `profile=hapa_open_10x9_v3_02` the legacy pair acknowledgment still applies (A stale; Acknowledge button), now without a forced drawer. **Pass.**
4. **Controllers** (z13).
   - **Invalid launch.** `a=robot&seed=-4` → A human / B bot, seed 1, two problems reported; the menu link reads `…?autostart=1&a=human&b=bot&seed=1`.
   - **A bot / B human.** The human views B, the bot is already committed, and one Ready resolves.
   - **Both bots.** Pause holds (no new Tick in 2.5 s), Step advances exactly one Tick and holds, and Stop disables Run. A New match restarts its own Ticks from 1.
   - **Preset.** A preset saved in setup (A bot / B human / seed 7) is used by a plain autostart, and URL roles override it. **Pass.**
5. **Same-Tick Mana** (labelled response fixture, z14 and c9).
   - burn → available `{red: 2}` → queued Ember Strike → `{}`;
   - undoing the burn leaves the cast invalid, Ready reads "Fix 1 order" and the toast names the invalid dependent;
   - restoring it makes the plan valid;
   - the genuine response window used each seat's actual pool;
   - exactly one accepted burn and one payment, and the damage resolved.

   In c9, a five-colour burn animated when planned (≥ 6 effects), and the accepted burn did not animate a second gain. A zero-Mana burn gave `{}` and no colour stream. **Pass.**
6. **Symbols and history** (z15, five-member Pawn, 1280×720).
   - **Archer:** `health=3/3`, `attack:0=2×1`, `range:0=2`, `shield:none=0`.
   - **Swordsman:** `3/3`, `1×3`, shield 1, with the hover text "Physical protection 1 on the front face; other faces meet 0".
   - **Stability:** the member stayed inspected while the pointer was on its symbol, and Escape closed the definition first.
   - **Keyboard:** Archer → → reached "2 separate hits of 1 Physical each (not one hit of 2)".
   - **History:** H opened history with nothing covered, still true after one orbit step. Closing it kept the selection `A.mount.C1`, its Supply order and the inspection. **Pass.**

## Visual evidence

Environment: headless Chrome 158.0.8127.37 on macOS Darwin 25.2.0, 1280×720 @1 unless stated, default text size, the Home camera at start, dev server 127.0.0.1:5199. Optional Tarot renditions are absent, so faces use the procedural fallback.

- **Continuous clips** (`635021d`/`cd69ad3` source, journey script [journey-08.mjs](evidence/2026-11-23/response-08/scripts/journey-08.mjs), step log [journey-log.json](evidence/2026-11-23/response-08/journey/journey-log.json)):
  - [journey-loop.mp4](evidence/2026-11-23/response-08/journey/journey-loop.mp4) (42 s): the whole ordinary loop, from the prologue through the blocked Queen, history, recovery, symbols and keyboard, to history beside inspection;
  - [journey-mana.mp4](evidence/2026-11-23/response-08/journey/journey-mana.mp4) (13 s): the labelled diagnostic, from burn to cast to one Ready, with the bot countering and A passing in the genuine response window;
  - [journey-bots.mp4](evidence/2026-11-23/response-08/journey/journey-bots.mp4) (11 s): running, Pause, Step, Stop.
- **Stills** taken from those clips:
  - [01 blocked route preview](evidence/2026-11-23/response-08/stills/01-route-blocked-preview.jpg)
  - [02 history names the obstruction](evidence/2026-11-23/response-08/stills/02-history-names-obstruction.jpg)
  - [03 blocker named, recovery quoted 0.5](evidence/2026-11-23/response-08/stills/03-blocker-named-recovery-quote.jpg)
  - [04 returned](evidence/2026-11-23/response-08/stills/04-returned-to-R1C6.jpg)
  - [05 shield definition](evidence/2026-11-23/response-08/stills/05-shield-definition.jpg)
  - [06 keyboard attack definition](evidence/2026-11-23/response-08/stills/06-keyboard-attack-definition.jpg)
  - [07 history beside inspection](evidence/2026-11-23/response-08/stills/07-history-beside-inspection.jpg)
  - [08 burn available now](evidence/2026-11-23/response-08/stills/08-burn-available-now.jpg)
  - [09 cast reserves its cost](evidence/2026-11-23/response-08/stills/09-cast-reserves-cost.jpg)
  - [10 bots paused / step](evidence/2026-11-23/response-08/stills/10-bots-paused-step.jpg)
- **Regression captures** are in each run directory under [regress/](evidence/2026-11-23/response-08/regress/), as JPEG with references updated. Enlarged-text captures (150%, 200%) are in z09.
- **Before captures:** review 07's supplied screenshots and probes stand as the "before"; they were not duplicated.

## Verification record

| Command or check | Revision / environment | Result | Establishes / limits |
| --- | --- | --- | --- |
| `npm run check` | `cd69ad3`, clean tree | exit 0: 123/123 tests, bot smoke, two-process peer match (120 Ticks, all receipts agreed, ends unfinished at its budget), build. [log](evidence/2026-11-23/response-08/npm-run-check-cd69ad3.log) | Rules, protocol (both policies), peers, build. The peer run on the new default ended at its Tick budget: it is reported as unfinished, not a win. |
| `tools/hapa/ui-regress.mjs` (contracts 2–5, all checks) | `bf05016`, clean | 423/424, 26 checks. The one failure was z12 counting every party's `travel_blocked`; B's Knight was legitimately blocked once by its own Castle at Tick 3. The check now counts the Queen's. | Whole-system fit. [run](evidence/2026-11-23/response-08/regress/2026-11-24T02-12-06-135Z-bf05016/report.json) |
| ui-regress `--only c1,c7,z01,z03,z12,z13,z15` | `635021d`, clean | 124/124 | Rechecked after the z12 count and wording fixes |
| ui-regress `--only z09,z12,z15` | `cd69ad3`, clean | 49/49 | Rechecked after the health-class fix. z09: 44 measured cases, none docked, symbol values ≥ 14 px at 100% and scaling at 150%/200% |
| ui-regress `--only c1,z12,z14 --sabotage` | `635021d` | 55/58, exit 1. The three sabotaged expectations fail: the extra resolution, the review 07 no-movement defect reinstated, and a double payment. | The new checks discriminate |
| `play-loop.test.js` (in `npm test`) | `42b970d`+ | 9/9 | Default profile, recovery (return / merge / finish), v3_02 legacy, clear diagonals, bot clearance, own-plan agreement, unknown policy, 8-Tick own-plan peer run with one Ready per Tick per log |
| [acceptance-probe.mjs](evidence/2026-11-23/response-08/acceptance-probe.mjs) | `cd69ad3` rules (unchanged since `42b970d`) | [results](evidence/2026-11-23/response-08/acceptance-results.json) | Review 07's cases under both profiles, with the Ready and Mana flow |
| Frame time / hover (c13, `bf05016`) | headless, this Mac | median and p95 frame 16.7 ms at both sizes; hover open 167–202 ms (includes the deliberate 150 ms delay) | Measurement only; no approved target |
| Live play in the Browser pane | `925a669`–`cd69ad3`, 1280×720 | Checked: the thin path (one Ready per seat; spamming Ready resolved one Tick), symbols and a hovered shield definition, the invalid-launch notice, and the strip's symbol row after the class fix | Not a human playtest |

Updated expectations, changed deliberately:

- **c1** now asserts one own-plan Ready, with a legacy v3_02 branch.
- **c9** asserts immediate availability, one animation and reconciliation.
- **z03** asserts that hover highlights and a tap opens the sources.
- **z08** follows focus to the first symbol; Escape closes the definition, then the explanation.
- **z10** finds the Mage label by identity.
- **z09** measures symbol values.

Review 07's baseline probes are unchanged and still assert the old behaviour.

## Decisions and next handoff

- **Design defaults to judge (no rule change):**
  - icon shapes and tints;
  - a 220 ms tooltip dwell;
  - the symbol level entering at about 112 px per member when the row room allows;
  - the preset in `localStorage`;
  - the history grouping;
  - reaching the source breakdown by tap or Enter instead of hover.
- **Versioned rules:** v3_03 is the new default. v3_02 and the base profile keep nearest-node recovery and pair acknowledgment.
- **Known limitations:**
  - Clearance is "known now". Formations moving in the same Tick can still meet; the rules still decide, and the event names it.
  - The draft Mana animation does not run in reverse on undo; the counts update immediately.
  - Live play checks used the in-app browser and headless Chrome only. There is no real touch device and no high-DPI hardware capture (HV-60 remains).
  - The first-build scenery frame noted in response 07 was not reworked.
  - The bot's strategy is unchanged apart from refusing friendly-blocked routes.
  - Concession at any phase remains HV-53.
- **Next for the reviewer:** play the link above as A against the bot.
  - At Tick 6 load C6, C5 and C4 into the Queen and look at R4C9 in Move ▾.
  - At Tick 13 bring it back.
  - Use the labelled response fixture for Mana.
  - Zoom into a formation and hover its symbols. Press H whenever you want history.
- **CJ acceptance: not yet recorded.** Cards are in Review.

### Overwatch receipts

Appended to `hapa-versus` as `task_comment` events: HV-55 (movement and recovery), HV-46 (one Ready), HV-56 (history and Mana), HV-58 (symbols and composition), HV-44 (accessibility), HV-60 (remaining device gaps) and HV-45 (the playtest link). Cards in Review stay in Review; HV-45 and HV-60 stay in Backlog.
