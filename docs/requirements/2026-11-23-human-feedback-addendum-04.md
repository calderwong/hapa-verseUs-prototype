# Human feedback addendum 04 — Center travel and agile Knights

**Consolidated 23 November 2026 · America/Los_Angeles**  
**Provenance:** CJ's direct local playtest instructions as quoted and summarized by the coding agent in [implementation response 09](../reviews/2026-11-23-ui-design-response-09.md), including its three addenda. The reviewer read that repository record, not the external local chat transcript. This document consolidates the recorded direction; it does not claim new user approval or CJ acceptance of the implementation.

## 1. Purpose and precedence

The game's current default must match the newer playtest decisions without requiring a new agent to reconstruct several responses. Master Requirements v3 and addenda 01–03 govern unchanged behavior. This addendum takes precedence only where response 09 records a newer decision.

In particular, it supersedes addendum 03 section 3/review 07's expectation that neighboring friendly bodies should retain the original opening half-step obstruction. That historical diagnosis remains true for its reviewed profile. It is not an acceptance requirement for the new default. Preserve legitimate enemy contact, terrain effects, Supply accounting and recovery where applicable.

The current implemented baseline is **`hapa_open_10x9_v3_06`**. The lineage below describes explicit existing profile boundaries; do not silently edit archived manifests to behave like the newest profile.

| Profile | Recorded change |
| --- | --- |
| v3_03 | Reachable-segment recovery and own-plan Ready from addendum 03 |
| v3_04 | Center-to-center friendly traversal, Pawn absorption on center arrival, either Knight L |
| v3_05 | Second Queen replaces each side's King |
| v3_06 | Free Knight travel turns, leg-facing and chosen arrival facing |

## 2. Travel should read as movement between territories

**HF4-01.** On clear flat ground, a normal-speed diagonal move advances from one territory center to the next for the applicable one-Tick/one-Supply step. Friendly bodies in a different territory do not cause the previous opening half-step stop. A friendly formation holding a territory entered can still obstruct ordinary line travel under the current rules. Enemy bodies continue to create contact and combat.

**HF4-02.** When a mounted formation's center reaches a compatible unmounted friendly Pawn's center, absorb the Pawn if the total living composition fits the nine-member capacity. This may occur at an intermediate route node; the route can continue with the combined party. A friendly formation that cannot be absorbed is not a legal final destination.

The absorption must conserve living members and assign them to unique valid slots. Dead slot references are not living capacity. These are correctness consequences of the composition rule, not a new gameplay feature. Review 08 identifies two violations requiring repair. A successful replay must reproduce a correct composition, not merely reproduce a corrupted one consistently.

## 3. Knights are agile, with explicit route and facing choices

**HF4-03.** A Knight may take either of the two L paths to the same endpoint. It passes through friendly intermediate territories and still engages enemy bodies. Final-destination occupancy/capacity rules continue to apply. Validation, simulation, previews, funding and bot eligibility must agree on the active profile's rules.

**HF4-04.** Give the player a visible L switcher and a clearly drawn selected path. Repeated right-click on the same drafted endpoint flips the L each time, replacing the existing order. Keep the explicit switcher and keyboard alternative; the shortcut alone is insufficient discoverability. The current implementation's default prefers a path that absorbs a Pawn, then a clear path. That default is an implementation choice still available for CJ's usability judgment, not a newly locked universal preference.

**HF4-05.** Knight travel turns cost no extra Tick or Supply. Face the direction of each leg when that leg starts. At arrival, default to the final travel direction unless the player chose an allowed facing. Show the chosen facing at the destination and provide a quick, discoverable control. The implementation currently provides an arrive-facing button, Shift+right-click and O cycling; ordinary L switching remains separate.

Other Mounts retain their existing travel-turn rules. A non-Knight does not gain a Knight-only arrival-facing command from this change. Speed must be visible where a player issues movement, and any estimated Tick count must come from shared movement semantics. Preserve the discoverable Face menu and its G shortcut.

## 4. Two Queens and the Commander

**HF4-06.** Each side's local Mount row is now:

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Castle | Knight | Bishop | Queen | Commander | Queen | Bishop | Knight | Castle |

Replace the former King in local C4 with a Queen for both seats. Preserve column colors, Tarot suit and Card bindings. Commander death remains a losing condition; response 09 records that the existing Capital capture condition also remains. Do not reinterpret the replacement as a new King-based victory rule or silently remove Capital capture.

Older profiles keep their recorded King and turn semantics for historical matches/replays.

## 5. Continue the already selected play loop

Addendum 03's one Ready per own valid plan, optional history, explicit development controllers, immediately spendable current-Tick Mana, compact member icons and contextual definitions remain in force. Addendum 02's deliberate spatial inspection and environment direction also remain.

The next implementation follows [assignment 10](../reviews/2026-11-23-next-agent-assignment-10.md) and [Loose Screws](../workflows/LOOSE_SCREWS.md): correct the confirmed inconsistencies, fit the connected journeys, then qualify the integrated candidate. This does not reopen all historical design proposals.

## 6. Disclosed behavior that is not a new decision here

Response09 notes that a Knight traveling two pitches per Tick along a three-pitch L can end a Tick inside a friendly-held intermediate territory, with visible overlap until travel continues. This record does not select a new stopping, waiting or displacement rule. Preserve current semantics during the bounded repairs and surface a concrete playtest problem if one occurs.

CJ's acceptance of the latest implementation is not recorded by this addendum. The Overwatch board remains the task-state authority; implementation and reviewer evidence support Review, while CJ decides Done.
