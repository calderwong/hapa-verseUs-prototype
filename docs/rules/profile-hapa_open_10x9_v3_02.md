# Profile `hapa_open_10x9_v3_02` — Supply-funded destinations

**Status:** default for new local matches, the bot smoke match and the two-peer tool from 22 November 2026. Implements [human-feedback addendum 01](../requirements/2026-11-22-human-feedback-addendum-01.md), HF-04. It is a variant of the v3 base profile `hapa_open_10x9_v3_01`, and every other value is unchanged. Rules version `hapa-versus-rules/0.2.0`; bot revision `heuristic-bot/0.2.0`.

## What changes

| Field | Value | Meaning |
| --- | --- | --- |
| `movement.destinationFunding` | `full_route_funded_v1` | A new or replacing voluntary destination, and a voluntary retreat endpoint, is accepted only if the party's Supply covers the whole remaining route at acceptance. That Supply is what the party holds plus loads accepted **earlier in the same plan**. Unassigned Cards, later loads, future mints and merges do not count. |
| `movement.debit` | `route_price_v1` | The debit follows each Mount's declared price. Every pitch costs `stepCost`, except a Knight's L, which costs `knightRouteCost` spread over its three pitches. Fixed-point debit uses the exact largest affordable step, so a funded route always arrives. |

Both are identical to v3 at baseline prices (`stepCost` 1, `knightRouteCost` 3). They differ only when a profile changes those prices. The v3 per-pitch debit could otherwise disagree with the Knight quote, or stall a few fixed-point units short of a node.

**Unchanged:**
- Speed is the rate, so a two-step Castle route with Supply 2 takes two Ticks.
- Nothing is prepaid or escrowed, and travel debits the actual distance.
- An accepted destination persists through later combat, terrain changes or a Supply pause.
- A rejected replacement keeps the previous goal.
- Automatic free pursuit and Card-defined movement keep their own cost rules; they do not pass through the funding check.

## The single quote

`quoteRoute(state, ctx, party, target)` in `src/hapa/rules/movement.js` measures the actual path from the party's present position: it finishes, or backs out of, an unfinished edge, then follows the Mount route. It prices that path with `pricePerUnit`, including the carried remainder. Every path uses it:

- `commandError` and `validatePlan`, which run in declared order on a scratch state, so earlier loads count;
- resolution, which re-checks each command at execution;
- `quotedDestinations`, for presentation: every legal target with `required`, `held`, `shortfall` and `funded`, never truncated;
- the heuristic bot, which picks and emits funding loads before the destination;
- peers and replay, through the same rules.

## Compatibility

Policies are named in the profile. **Absence means v3:** `partial_supply_v3` and `step_cost_per_pitch_v3`.
- Old manifests and the v3 golden fixtures carry no such field, so they replay with their original behavior; their bytes and fingerprints are not altered.
- `validateProfile` rejects any unknown value.

Tests: `tests/hapa/funding.test.js` covers both profiles, mid-edge 2.5-Supply replacement, non-default prices against the actual debit, preceding-load rules, and bot parity with replay verification.
