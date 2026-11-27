# Human feedback addendum 11 — optional Mesh Avatar players

**Recorded:** 26 November 2026, CJ's local date.  
**Source:** CJ requested adding “Mimi/Falka, Leo, and Thor” Mesh Avatars as optional players, with a system to toggle them into play alongside multiplayer. CJ also said the implementing agents are waiting for their allowance window and are not ready for review of the previous work.  
**Status:** selected requirements and queued tasking only. No new implementation, runtime check, release, owner-asset discovery or readiness review is claimed.

## 1. Selected scope

Extend the existing Avatar player integration into an extensible roster containing Red and the requested optional choices:

| Requested display entry | Required binding | Initial selection behavior |
| --- | --- | --- |
| Red | Preserve the current verified owner binding and controller configuration | Remains the existing default; preserve an explicit saved user choice |
| Mimi / Falka | Resolve the actual Avatar owner identity, alias relationship and Mesh package | Listed as an optional choice; opt in through the roster or direct selection |
| Leo | Resolve the actual Avatar owner identity and Mesh package | Listed as an optional choice; opt in through the roster or direct selection |
| Thor | Resolve the actual Avatar owner identity and Mesh package | Listed as an optional choice; opt in through the roster or direct selection |

“Mimi / Falka” is one requested display entry until the owner data resolves the canonical identity/alias relationship. The slash is not an instruction to invent or merge identity records. If the actual owner identifies two distinct Avatars, preserve them as distinct verified entries and report that mapping. Do not guess IDs, asset paths, rigs, voices, models, personalities or capabilities from names.

Use each Avatar's actual owner-provided Mesh Avatar package/player and permitted identity context. A renamed Red, generic bot label or substitute portrait does not satisfy the selected Mesh presentation. Record the actual renderer kind and package revision; a package name alone does not establish volumetric rendering. Rig/framing/gesture behavior must fit the real package, including non-humanoid performers where applicable.

## 2. Player setup and toggles

Add a compact **Players** surface to the existing Home/setup/lobby flow. Keep three operations distinct:

1. **Use in my roster:** a persistent local preference making that Avatar available for selection. New optional entries start off; Red keeps its current default. Directly choosing a ready Avatar for a local game can enable its roster entry in the same deliberate action.
2. **Choose for this game:** assign a supported controller and presentation to the locally owned seat in a new match. Local play normally remains **You versus the selected Avatar**. Enabling several roster entries does not start several controllers or put more players at the table.
3. **Available online:** an additional explicit host opt-in that advertises one supported Avatar-controlled player through the existing multiplayer system. It is off initially and never follows automatically from the roster toggle.

Versus remains a two-seat, 1v1 game. Human-versus-human multiplayer stays a direct path. The roster must support local Avatar opponents and the queued online Avatar participation path without introducing extra seats or changing gameplay rules. Avatar-versus-Avatar exhibition can reuse the existing development controller seam later; a new public tournament/watch mode is not a prerequisite for this iteration.

Expose identity, controller and presentation readiness separately. Unconfigured choices remain visible with a short reason and recovery action; an unavailable optional Avatar must not block Red, local play or human multiplayer. No extra confirmation dialog is needed for ordinary pre-match selection.

## 3. Authority and controller behavior

Keep these separate: **seat authority**, **decision controller**, and **visual performer**. Displaying a Mesh does not transfer control. A controller submits bounded proposals through the authorized seat's existing validation/admission/signing path; it never writes a second authoritative feed or controls the other seat.

Support the existing legal heuristic controller as the minimal standalone play mode, labeled honestly, and the actual Avatar/Harness decision path when that owner capability is configured. Do not imply character-specific reasoning when the moves are heuristic. Reuse the permitted identity/model configuration; no invented per-character strategies or required new model deployment.

Freeze the accepted participant/controller binding at match start. Changing roster preferences during a match applies to later games. It cannot replace the current player, undo Ready, reset keys, alter the remote seat or convert a disconnect into a concession. Live controller handoff is deferred until an explicit agreed protocol exists.

Separate renderer/voice failure from decision failure and peer-host failure. Missing optional presentation can degrade visibly without blocking valid game progress. A model timeout uses the preselected legal fallback policy and records that fact; peer-host loss uses normal reconnect/recovery. No silent substitution of another Avatar, human impersonation or fabricated result is permitted.

## 4. Multiplayer participation and attribution

An online Avatar is hosted by an authenticated, authorized participant. Bind the advertised Avatar reference, actual host/seat authority, controller kind, app/protocol and current availability. A discovered label or cached roster item is not an online seat grant. Admit the participant through the normal challenge/invitation and match-agreement path.

Working default: **one active match and at most one advertised Avatar player per current native runtime**. Hosting an Avatar means the local human observes that seat while its selected controller operates it. Manual input cannot race the controller. Additional concurrent hosting is separate work.

Peers must acknowledge versioned participant metadata before starting an Avatar-controlled online match. Keep `hv1`, existing signed game records and archived semantics compatible. Human matches retain their supported existing path. An older peer that cannot acknowledge Avatar attribution must refuse that mode visibly instead of silently treating the Avatar as a human.

Results and profiles distinguish human-versus-human from human-versus-Avatar and any later supported combinations. Record actual seat authority, canonical Avatar reference/revision, controller mode/policy and actual decision/fallback provenance. Avatar results must not inflate the sponsoring human's human-versus-human record. Historical records without controller metadata remain unknown/legacy rather than being relabeled by appearance.

## 5. Ownership, delivery and resource boundaries

Reuse Avatar Builder, Mesh/Harbor, Harness and Second Brain through their existing owner contracts. A roster entry is a small versioned binding to owned identity, renderer and optional decision/voice capabilities. Do not create another Avatar database, broadcast controls into unrelated Mesh windows, copy root secrets or export private mind/history with a player advertisement.

Package only approved, allowlisted rendition/runtime assets with exact owner revisions/digests. A human playing against a remotely hosted Avatar must not need the host's owner apps, model weights, credentials or developer setup. If optional public presentation bytes are unavailable, the remote human can use an honestly labeled neutral display while the authenticated game continues.

Roster enablement is lightweight. Load selected assets when needed; inference occurs only for an active admitted decision. Reuse existing model ownership and bounded jobs; no background matches or additional models are started because several names are toggled on. Talk/voice remains an independent optional capability.

## 6. Sequencing and acceptance

[Assignment 20](../reviews/2026-11-26-next-agent-assignment-20.md) remains the current connectivity/friend-test work. [Assignment 21](../reviews/2026-11-26-next-agent-assignment-21.md) queues this roster and Avatar participation scope after reconciliation of that work when the agent resumes. The new optional players do not become a blocker for the existing human-versus-human friend test.

The [optional Avatar players companion](../integrations/optional-avatar-players-v1.md) supplies the UI/state/binding/acceptance design. When implementing, use Loose Screws: assemble the complete local roster path first, fit online Avatar participation to the corrected P2P boundary, then qualify the affected journeys. Reuse valid evidence and avoid a broad review/test cycle while the agent is waiting for its allowance reset.

Every requested Avatar requires a verified owner mapping, its actual selected Mesh presentation, and a legal playable controller path before it is marked delivered. Report local roster, model-assisted capability, online availability, packaged presentation, independent-network testing and CJ acceptance separately. Review 19 remains the latest review; this requirements publication neither reruns it nor closes its findings.
