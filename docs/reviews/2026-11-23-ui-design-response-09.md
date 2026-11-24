# Implementation response 09 — 23 November 2026

**Travel goes center to center, a Mount absorbs the Pawn whose center it reaches, and a Knight takes whichever L you choose.** This answers CJ's direct playtest feedback after [response 08](2026-11-23-ui-design-response-08.md); no new review document exists for it. CJ's words, from the session:

> "A tick movement should be center-to-center. The bishop moving 1 tick for 1 supply should have put it on the center of R2C4 and picked up the pawn … I also need the knight to allow both L possible paths … When the mount in the center reaches the un-mounted center of a pawn, that's when the pawn gets absorbed."

CJ's answers to three follow-up questions:

1. Knights move through friendly territories but engage enemies.
2. Knight paths get a "slick switcher and icon" with a default L that is quick to flip.
3. Enemies keep body contact.

**CJ acceptance: not yet recorded.**

## Play it

Run `npm run dev`, then open **http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1**, the same link as response 08. New matches use profile **`hapa_open_10x9_v3_04`**.

- **Bishop:** at Tick 3, load the C7 and C3 Cards into the Bishop and order R5C7. It steps onto R2C4's center, absorbs that Pawn, and continues.
- **Knight:** at Tick 2, load two Cards into the Knight and pick an endpoint in **Move to ▾**.
  - The command bar then shows the **L switcher**, with both paths drawn as small L icons and the default highlighted. Click the other L, or press **L**, to flip it.

## What changed

**Rules.** The new default is profile `hapa_open_10x9_v3_04`. Archived profiles keep their semantics: `v3_03` still has the reviewed half-step block, and its tests and browser check z12 are pinned to it.

- **Center-to-center travel** (`movement.traversal: center_to_center_v1`).
  - **What blocks a step.** Only a friendly formation holding the territory being entered. Bodies in neighbouring territories no longer stop a step, which was the source of the Bishop's and the reviewed Queen's half-steps.
  - **Absorbing a Pawn.** Arriving on an unmounted friendly Pawn's center absorbs it, as long as the total stays at nine members or fewer. This also works at an intermediate node, so the party continues its route.
  - **Where you can stop.** A territory held by another friendly formation (one it cannot absorb) is not a destination: it is neither offered nor accepted.
  - **Enemies** still meet on body contact. One test checks this outcome is identical to `v3_03`.
- **Either Knight L** (`movement.knightPaths: either_l_v1`).
  - `set_destination` may carry `via: 'long'` (two long-axis steps first) or `via: 'short'` (the short step first).
  - A Knight passes through friendly-held territories; a friendly holder stops it only at its final node.
  - Older profiles refuse `via: 'short'`.
- **One rule everywhere.** The preview, validation, simulation and bot share it. `routeClearance` applies the same obstruction rule and counts the members a route has already absorbed.

**Bot.** The heuristic bot weighs both L paths and never targets a held territory.

**Interface.**

- Each Knight destination gets a default L: the path that absorbs a Pawn, else a clear one.
- The Move list names it, e.g. "L via R2C2, R3C2 (L flips) · absorbs your Pawn on the way".
- After you order it, the command bar shows the **L switcher**: both paths drawn as L icons in your orientation, which squares each passes, "absorbs Pawn" or "✕ blocked", and the **L** key. Flipping places the same validated order with the other path.
- A drafted destination's route, including the chosen L, is drawn on the board.
- Order text names the chosen L.

**Commits** (on `af774e5`):

| Commit | What |
| --- | --- |
| `f07602f` | Center-to-center traversal; either Knight L; bot; UI switcher; tests and browser check z16 |
| `e6df0ed` | Friendly-held territories are not legal destinations (Move list, highlights and bot never offer what validation refuses) |
| `021adaa` | c8 expectation updated for that rule |

Engine gitlink `ba838cc` is unchanged.

## Observed results

### CJ's opening cases

Seed 1, A's orders only, actual headless rules. Output: [opening-cases.txt](evidence/2026-11-23/response-09/opening-cases.txt), from [opening-cases.mjs](evidence/2026-11-23/response-09/opening-cases.mjs).

| Order | Observed | Matches CJ's description |
| --- | --- | --- |
| Bishop R1C3 → R5C7 (Tick 3) | Tick 3: absorbs the Pawn on R2C4 (`A.pawn.C4`), standing on R2C4's center with 3 Supply left; by Tick 5 at R4C6 | Yes |
| Knight R1C2 → R3C3, long L | Absorbs R2C2's Pawn on Tick 2; arrives Tick 3 | Yes |
| Knight R1C2 → R3C3, short L | Passes the Bishop's R1C3, absorbs R2C3's Pawn, arrives | Yes; takes one Tick longer (see below) |
| Knight R1C2 → R2C4, long L | Passes the Bishop and King, ends on R2C4 and absorbs that Pawn | Yes |
| Knight R1C2 → R3C1, short L | Passes the Castle's R1C1, absorbs R2C1's Pawn, arrives | Yes; takes one Tick longer |

Two existing rules show up in these cases:

- **Turning costs a Tick.** A Knight whose short-first L starts sideways spends one Tick turning before it moves. This is the existing rule: an orthogonal first leg that differs from the facing takes one Tick to turn.
- **Capacity.** Ordering R2C4 by the short L absorbs R2C2's Pawn first and makes the Knight full at nine members. It then stops before R2C4's Pawn, because it cannot absorb a second one. The preview reports that capacity.

All of these replays verify.

### Bot matches

Bot-versus-bot on the default profile:

- **Absorbing Pawns:** 14 Pawns absorbed and a decided match by Tick 24, for seeds 1, 2 and 3, with no rejected bot orders after the held-destination fix.
- **Peer match:** `npm run check`'s two-process peer match agreed on every Tick and ended in a win at Tick 23. On `v3_03` the same peer match ran to its 120-Tick budget unfinished (response 08 log).

### Browser

Check z16 runs the live app at 1280×720: the Knight's Move list entry, the switcher with both paths, **L** flipping to the short L, the Knight absorbing R2C3's Pawn and standing on R3C3's center, and the Bishop absorbing R2C4's Pawn in one Tick for one Supply, never blocked.

Captures:

- [knight switcher](evidence/2026-11-23/response-09/regress/2026-11-24T03-32-46-505Z-e6df0ed/z16-knight-switcher.jpg)
- [bishop absorbed](evidence/2026-11-23/response-09/regress/2026-11-24T03-32-46-505Z-e6df0ed/z16-bishop-absorbed.jpg)

## Verification record

| Command or check | Revision | Result |
| --- | --- | --- |
| `npm run check` | `e6df0ed`, clean | exit 0: 129/129 tests (new: `center-travel.test.js`, 7 tests), bot smoke, two-process peers, build. [log](evidence/2026-11-23/response-09/npm-run-check-e6df0ed.log) |
| ui-regress, full contract 2–5 plus z16 | `f07602f`, clean | 433/434. c8 offered R1C4, which A's own King holds, as an "unfunded target"; the validator correctly refused it as held. That led to `e6df0ed`. [run](evidence/2026-11-23/response-09/regress/2026-11-24T03-24-03-863Z-f07602f/report.json) |
| ui-regress `--only c7,c8,c10,z01,z03,z08,z12,z13,z16` | `e6df0ed`, clean | 152/153. The one failure was c8's old expectation that R1C2 and R1C3 (A's own Knight and Bishop) are destinations; I updated it deliberately in `021adaa`. |
| ui-regress `--only c8` | `021adaa`, clean | 20/20 |
| ui-regress `--only z16 --sabotage` | `e6df0ed` | 9/10, exit 1: expecting the long L despite the flip fails, as intended |
| Live play in the Browser pane | `f07602f` | Knight at Tick 2: list labels, switcher, **L** flip to `via: short`; after Ready it absorbed R2C3's Pawn and stood on R3C3 |

Checks not rerun after `e6df0ed`: c1–c6, c9, c11–c14, z06, z07, z09–z11, z14 and z15. They passed in the full run at `f07602f`. `e6df0ed` only removes friendly-held territories from destination lists, and none of these checks orders a move into such a territory.

## Limitations and decisions

- **Knights between Ticks.** A Knight can end a Tick inside a friendly-held territory partway along its L, because two pitches per Tick on a three-pitch L can stop on an intermediate node. The two formations then overlap until the Knight continues next Tick. I left this as is rather than invent a waiting rule.
- **Line Mounts and held territories.** A Rook, Bishop or Queen whose line passes a friendly-held territory is stopped at that territory's edge, chess-like. The Move list marks such routes "✕ blocked". Only Knights pass through.
- **The L icon** is drawn in the viewer's orientation, with forward pointing up.
- **CJ to judge:** the default-L choice (prefer absorbing a Pawn, then a clear path) and the switcher's look.
- **CJ acceptance: not yet recorded.** Evidence was appended to Overwatch HV-55.
