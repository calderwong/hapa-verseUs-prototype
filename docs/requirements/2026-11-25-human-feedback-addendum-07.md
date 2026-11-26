# Human-feedback addendum 07 — Clone, connect, find an opponent and play

**Date:** 25 November 2026, America/Los_Angeles.  
**Owner:** CJ / Hapa.  
**Status:** Selected product scope; implementation defaults are identified below. This document does not claim the feature is implemented or tested.

## Why this work is selected

CJ wants another person, on another computer and internet connection, to clone Hapa Versus, install it quickly, launch it, find other players and complete a peer-to-peer match over Hypercores. Players must be able to show whether they are available or busy, create and join challenges, and see durable match outcomes and statistics on matchmaking profiles.

This is the next feature milestone after [Review 15](../reviews/2026-11-25-ui-design-review-15.md). That review closed its selected music/scene corrections; this request supplies a new goal. Preserve that delivered experience and the current game rules while adding online play.

## Required player outcomes

| Requirement | What must work for a person using a fresh installation |
| --- | --- |
| **Install and launch** | A documented, short command sequence obtains every required distributable dependency, installs the locked dependencies, and starts the game and its peer runtime together. No CJ-specific folder, private token, model account or other Hapa application is required for the base game. |
| **Find people** | The online lobby shows discovered players with names, stable identity fingerprints, connection freshness and compatibility. Network failure is distinguishable from an empty lobby. |
| **Choose availability** | A player can select Available or Busy. A reserved/active match makes that player busy automatically. Offline or stale presence cannot remain indefinitely Available. |
| **Create or join a challenge** | A player can challenge a listed opponent, host an open table, or join using a copied invitation. Acceptance fixes the two seats, identities, rules/content and match identity automatically, without an additional administrative confirmation screen. |
| **Play remotely** | Two independent installations control their respective seats. Signed player inputs travel through separate Hypercores; both peers validate the same rules, compare state and retain replay evidence. One Ready commits one's own plan once. |
| **Recover** | A transient disconnect or process restart preserves identity, agreed match progress and already committed inputs. A broken connection does not manufacture a win or loss. |
| **Keep and share results** | Each player retains the result and replay evidence. Other peers can verify published evidence and project wins, losses, draws and rates into visible profiles without trusting a mutable self-reported win counter. |
| **Keep the game usable** | Matchmaking and connection states belong in a compact game interface. During play, the board, deliberate inspection, optional history, same-Tick Mana and seated-opponent presentation keep their existing behavior. |

## Selected implementation defaults

These are the reviewer's working defaults, chosen so the coding agent can proceed without asking CJ to design infrastructure at every step. The detailed contract and reasons are in [P2P play and matchmaking v1](../integrations/p2p-matchmaking-v1.md).

- Ship a standalone Node peer runtime behind the existing browser game. A single launcher owns both processes. Keep HTTP bound to loopback; use Hyperswarm/HyperDHT for internet connections.
- Start with one public casual lobby and the exact bundled `hapa_open_10x9_v3_07` profile/catalog/decks. Preserve `own_plan_ready_v1` and archived protocol meanings. Reject incompatible sessions visibly.
- A persistent full public key identifies a player. A display name or Avatar can change without resetting that identity's history. A local game key is not automatically a verified Hapa identity.
- Separate expiring live presence, durable player-owned records, and rebuildable public indexes. Include a headless directory/result-seeder mode and a configurable blind-relay integration. These roles provide discovery, availability and connectivity; they do not decide a winner.
- Public casual matches publish bounded gameplay replay evidence for independent verification. Do not publish private Hapa memory, service credentials, voice, chat, music assets or operational logs as match telemetry.
- Public statistics count verified completed matches, with controller and rules buckets. Missing proof, interruption, disputed state or an unfinished run are shown separately. There is no ranked ladder, cash stake or claim of Sybil resistance in this milestone.
- Keep the existing concession command's planned, agreed-Tick behavior. Closing a browser is not concession. An immediate network-level resignation or timed-forfeit rule is future product work, not an implicit transport change.
- Optional Avatar, Music, Harness, Overcard, Overwind and Second Brain integrations must not become prerequisites for finding a player and completing a match. Remote media transfer is a separate owner integration; local music remains usable where installed.

## Real prerequisites and evidence limits

At the reviewed baseline `8036a3df0e4289ef203e54838df76ef22e053e53`, the game repository is public, but the required `lumina-hapa` submodule is private. Resolve an accessible pinned runtime distribution or explicitly limit an interim build to invited testers with access. Do not call that interim build anonymous clone-and-run. Do not change a private repository's visibility or publish its history as a shortcut.

The existing peer check uses two bot processes over loopback. Its success is useful groundwork, not evidence that remote humans can discover each other, traverse NAT, recover a restarted process or see each other's public statistics.

The selected delivery must include actual separate-machine, separate-network evidence. If a collaborator, approved engine artifact or operated relay/seeder is unavailable, finish independent work and report that exact gate. Do not fill the gap with more local simulations or declare the remote requirement met.

## Authority and handoff

This addendum adds network product behavior. Master v3 and compatible addenda 01–06 continue to govern gameplay and presentation. New online schemas wrap existing records; they do not retroactively change archived matches. A compatibility change must be explicit and versioned.

Use [Assignment 16](../reviews/2026-11-25-next-agent-assignment-16.md) and [Loose Screws](../workflows/LOOSE_SCREWS.md): assemble the full connected journey, then tighten the changed network boundaries and qualify the integrated candidate. The Overwatch board `hapa-versus` remains task truth; CJ accepts work to Done. Publish one coherent response and stop automatic continuation at completion or a concrete unresolved external gate.
