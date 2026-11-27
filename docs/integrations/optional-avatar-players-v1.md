# Optional Avatar players v1 — roster, seats and online participation

**Date:** 26 November 2026.  
**Authority:** [Addendum 11](../requirements/2026-11-26-human-feedback-addendum-11.md).  
**Status:** queued design contract for implementation, not an implemented API or new review.  
**Task:** [Assignment 21](../reviews/2026-11-26-next-agent-assignment-21.md), after reconciling the current Assignment 20 work.

## 1. Experience to deliver

CJ can enable **Mimi / Falka**, **Leo** and **Thor**, choose one as the local opponent and play with that Avatar's actual owned presentation. The same roster can expose a properly attributed Avatar-controlled participant in the online lobby when the authorized host explicitly makes it available. Existing Red and human multiplayer remain useful throughout.

Keep the game at two seats. A roster is a set of eligible choices, not a request to run every Avatar at once. The first native host supports one active game and one advertised Avatar player at a time. A multi-match bot farm, extra board seats, public tournament mode and live controller transfers are outside this first scope.

## 2. Compact setup and roster UI

Keep **Play on this computer** and **Play online**. Add **Players** near their setup controls rather than another permanent board panel.

Each roster row shows the requested display name, a small owner-provided preview when available, **Use in my roster**, and concise status. Details expose owner reference/revision, actual renderer kind and supported control modes. Do not display implementation tokens or private paths in the player flow.

Initial behavior:

- Preserve a recognized saved selection, including an unavailable choice with its status. Use the current Red default when no prior choice exists; an owner outage must not silently replace a selected Avatar.
- List the new requested choices without silently enabling, selecting or advertising them.
- A direct **Play against Leo** action may enable and select Leo together when ready. It must not also turn on online hosting.
- Disabling an entry removes it from future selection/advertisement eligibility. If selected in an unstarted setup, clear that selection and ask for another eligible choice in the same form; do not silently choose a different character.
- A running match retains its pinned binding. The UI says the roster change applies to the next game. Disabling cannot eject the current player or cause a concession.
- Restoring preferences does not automatically start a match, inference or online advertising after launch. Online hosting requires a current explicit session action; a saved preference can prepare the control without publishing it.

### Participation choices

| Path | Local authority and control | Other seat | Player-facing result |
| --- | --- | --- | --- |
| Local play | Local human controls their own seat | Selected local Avatar controller | You versus Red/Mimi-Falka/Leo/Thor, with controller mode visible |
| Human multiplayer | Existing authenticated human seat | Remote authenticated human | Existing friend challenge/invitation flow |
| Play an online Avatar | Local human seat | An authenticated host's advertised Avatar-controlled seat | Challenge explicitly labeled Avatar player |
| Host my Avatar online | Local host owns the signing boundary; selected Avatar supplies decisions | Remote human or another explicitly supported participant | Hosting an Avatar, with local human observing rather than issuing competing game commands |

Do not provide a control that can assign an Avatar to another person's seat. A purely cosmetic appearance choice for a human, if supported later, must leave controller type human; the mesh is not evidence of autonomy.

## 3. Availability is several independent facts

Use a small state model with recoverable reasons:

| State | Meaning and action |
| --- | --- |
| Known / not configured | Requested label is recorded, but canonical owner binding or required package is unresolved; show Configure/Open owner if the existing integration supports it |
| Ready locally | Verified identity binding plus a supported local controller; presentation status is shown separately |
| Presentation unavailable | The figure/voice could not load; retain identity, offer retry, and explain any explicit play-without-figure path |
| Controller unavailable | Required selected decision capability is unavailable; choose a supported preset or retry before starting |
| Available online | A current opted-in host is advertising a compatible, ready participation offer |
| Busy | Capacity or an existing reservation/match prevents accepting another game |
| Offline / stale | No recent live availability; a cached contact remains known without claiming online status |

An installed mesh alone establishes only presentation availability. A heuristic can provide a playable controller without a language model, but its label must say so. A declared model capability must be backed by the actual permitted owner/runtime, not by a placeholder adapter.

After a cosmetic outage, an already accepted game can continue if its controller and peer authority remain sound. Show which capability failed. Do not use one generic “Avatar offline” state for unrelated renderer, voice, inference and network failures.

## 4. Small binding model

The following names describe required semantic fields, not existing owner IDs, HTTP routes, Card registrations or released schemas. Implement with current owner contracts and a versioned application adapter.

| Object | Required distinctions |
| --- | --- |
| Roster entry | Local stable entry ID; requested label/aliases; canonical owner namespace and Avatar reference; verified revision/digest; provenance; configured capabilities |
| Local preference | Enabled-for-selection; last explicit local choice; controller preset; presentation/motion/audio preferences; separate from public presence |
| Presentation binding | Exact owner package/revision/digest, renderer kind and supported framing/motion/voice capabilities; own actor/session scope |
| Controller binding | Human, legal heuristic or actual Avatar/Harness provider; exact permitted Avatar context; mode/version; finite deadline and declared fallback policy |
| Match participant binding | Match/seat; actual authenticated signing authority; human/Avatar control classification; canonical Avatar reference/revision when applicable; controller policy; separate presentation reference; binding digest/version |
| Online offer | Authenticated host/contact reference; public Avatar binding; supported protocol/features; capacity/availability epoch; freshness/expiry; no private memory or secrets |

Resolve Mimi/Falka against the real owner: keep an alias only if the owner says it is an alias. If two distinct identities exist, keep both distinct and report the mapping rather than silently merging them. Leo and Thor likewise require actual owner references. Requested names are not credentials.

Preserve historical match bindings when a display name or owner revision changes. Changes select a new binding for a later match; a current result retains the revision that actually played. Local roster removal does not delete identity, match history or the source owner's records.

## 5. One seat authority and finite decisions

Reuse the [existing decision/observer/performer contracts](avatar-opponents-and-music-discovery-v1-contracts.md) and their current implementations. Reconcile those historical notes with the current code before editing; do not build a second decision loop merely to add another name.

The seat owner remains the sole authority that validates and signs/appends actions. An Avatar controller proposes a bounded plan or response through that boundary. Bind every request to match, seat, session/controller generation, Avatar binding revision, Tick/phase, choice/request ID and the actual admitted input. Validate legality through the same rules as other controllers.

Select controller policy before starting:

- **Local heuristic:** uses the existing legal heuristic path, with the selected Avatar's presentation. The UI and evidence identify heuristic decisions.
- **Avatar-assisted:** uses the actual supported Avatar/Harness path with permitted context and the existing finite decision budget. A preselected legal heuristic fallback remains within that advertised policy; record its actual use.
- If the selected policy has no valid fallback and cannot produce a legal response, expose the existing recoverable pause/error behavior. Do not manufacture a win, concession, extra Ready or another participant's choice.

Freeze authority/controller bindings for the match. A generic preference toggle is not a live handoff protocol. Manual controls do not race an Avatar controlling the same seat. Switching to another Avatar/controller requires a new match in v1; future handoff would need explicit peer agreement and a new authority generation.

Cancel and fence inference, voice and performer callbacks on new match, disposal or binding replacement. A late result from Mimi/Falka cannot affect Leo's new match even if the board happens to look identical. Restart/rejoin reconstructs the accepted binding and existing own-seat journal; it never starts a second writer.

## 6. Online Avatar offers and match agreement

Use [Hapa Connectivity v0.1](../protocols/hapa-connectivity-v0.1.md) for contact/provider/session behavior. No extra signaling service, directory, global daemon or CJ-operated VPS is required by this feature.

The online controls are explicit and local:

1. Enter Play online as the current authenticated host.
2. Select a configured roster Avatar to host and choose **Available online**.
3. Advertise a bounded expiring offer that says it is an Avatar-controlled player and identifies its actual host/authority.
4. A challenger sees that classification before challenge/accept. Default to the existing deliberate accept interaction; automatic acceptance, if added, is a separate off-by-default policy with the same capacity and admission checks.
5. Reserve one supported game, mark the host busy and admit the match through the normal authenticated setup. Other roster entries do not create additional active players.

A lobby filter such as **Show Avatar players** may expose these entries without changing the direct human-friend flow. The filter is discovery UI, not authority to host or accept games. Offers expire if the host disappears; withdraw them promptly when possible. Expiry is not a game result.

Participant/controller attribution must be covered by an agreed versioned match setup or a digest-bound companion whose verification is part of that setup. Include the real signing principal and, separately, the resolved Avatar reference and declared controller policy. A host operating its own seat for an Avatar does not thereby possess the Avatar owner's private key. Any claim to represent an independently controlled owner identity needs that owner's real authorization/delegation contract.

Negotiate support before beginning an Avatar-controlled online match. Reject unsupported attribution visibly. Never downgrade an Avatar-controlled offer into a human match for an old peer. Preserve ordinary human matchmaking and all existing supported historical signature semantics; do not reinterpret old bytes or weaken verification to fit new metadata.

A remote human needs only the Versus app and its normal invite/challenge path. They do not need the host's models, Builder, Mesh server, private credentials or mind store. Transfer presentation references or approved public assets only within actual owner capabilities. A neutral labeled display is allowed when remote media is unavailable; the opponent's controller identity remains explicit.

## 7. Mesh, voice and interaction quality

Attach the actual requested owner package. Record renderer kind honestly: a package called Mesh Avatar does not by itself prove a volumetric mesh, and reusing Red's plane with a new label is insufficient. Show the package the owner actually supplies and the expected character appearance. Any unresolved asset/mode is a specific dependency for that entry, not a reason to fabricate a replacement.

The selected figure occupies the existing opponent location without covering tactical interaction. Fit bounds, scale, anchor and close/orbit behavior to the actual figure. Human and non-humanoid packages may require different framing and supported motion vocabularies; unsupported gestures should be omitted or mapped by the owner, not forced through Red's hand rig.

Maintain one scoped performer/audio owner for the selected participant. Do not use a broadcast control endpoint that animates every Mesh window. Reuse supported idle/react/speak and disposal operations. Preserve local mute, reduced-motion/quiet settings and the current music boundary. Voice or lip-sync absence must not prevent legal gameplay.

Load only selected assets and admit one finite decision job per active controlled seat. Enabling all optional rows does not warm models, continuously poll minds or launch background matches. Use current Harness/model ownership; no required new model download or paid provider. Keep social observations and game-decision inputs separate, and retrieve only permitted context through its owner. Public lobby metadata carries no private dialogue, memories, credentials or local filesystem paths.

## 8. Results, profiles and provenance

Before play, both peers know whether each seat is human-controlled or Avatar-controlled and which supported policy applies. After play, exports bind the actual seat authority and accepted Avatar/controller metadata to the verified match.

Keep human-versus-human outcomes separate from human-versus-Avatar and later supported combinations. Aggregate Avatar play under canonical Avatar reference plus relevant controller/version/profile context, while retaining the actual host/signing authority for provenance. A human sponsor must not gain human-versus-human wins simply by operating an Avatar. Appearance changes do not change match classification.

Record actual model/fallback decision provenance through bounded receipts or existing audit mechanisms tied to the match and admitted request. Do not serialize full prompts or private memory into public results. A successful signature proves record authority; it does not prove that a language model was used or establish a broad anti-cheat guarantee.

Existing records without participant-kind metadata remain legacy/unknown for that dimension. Replays use retained authoritative actions and pinned public metadata; replaying a game does not rerun inference or silently fetch private owner context. A later alias update cannot rewrite who a historical record says participated.

## 9. Delivery slices and focused acceptance

Implement in two slices after reconciling the current assignment:

**Slice A — local roster and real presentation.** Resolve the actual owner mappings, add the descriptor-driven roster, preserve the default, select each requested Avatar, attach its actual Mesh presentation and play with the legal controller. Persist preferences and exercise lifecycle/fallback boundaries. This slice can proceed independently of an external second machine once the agent resumes.

**Slice B — online Avatar participant.** Add opted-in availability, authenticated host/participant metadata, negotiated setup, one-runtime capacity, explicit result classification and the actual connected journey. Use the corrected Assignment 20 foundation. Keep human friend-test qualification independent from these optional opponents.

| Case | Required result when implemented |
| --- | --- |
| Existing profile and clean startup | Saved choice is preserved; otherwise Red remains default; new entries do not auto-run or auto-advertise |
| Enable all requested entries | Multiple choices become eligible; no extra seat, inference job or match is created |
| Each requested Avatar | Actual canonical mapping and owner package demonstrated; legal local play and stated controller mode |
| Missing identity/package/controller | Exact unavailable capability and recovery shown; existing human/Red paths remain usable |
| Selection and removal | Direct selection works without redundant confirmations; pre-match removal clears invalid choice; in-match change applies to the next game |
| Cross-Avatar lifecycle | Late inference/audio/renderer completion from a previous binding cannot affect the new one |
| Renderer versus model versus host outage | Correct capability-specific behavior; declared finite fallback or recovery; no false concession |
| Online opt-in and expiry | No offer from roster enablement alone; compatible expiring Avatar offer appears only after host action |
| Competing challenges and reconnect | At most one admitted active match/writer per runtime; existing seat authority/journal retained |
| Unsupported peer or mismatched binding | Avatar match refused before play; supported human matches continue |
| Human versus hosted Avatar | Both sides see correct participant kind; remote human needs no owner apps/models; own-seat rules preserved |
| Results and replay | Correct mode/provenance, no human-stat contamination, no inference on replay, legacy records preserved |
| Installed scene | Selected package at Home/close/orbit with appropriate framing and cleanup, in the actual artifact |

These are future acceptance criteria, not executed tests. Use the smallest checks during assembly, then the required final implementation gate and changed local/native/installed journeys. Label source/model fixtures, real native connections, installed platforms, independent networks and CJ acceptance separately.

## 10. Owner-resolution worksheet for the implementation response

For Red and each requested entry, record: requested label, canonical owner reference, aliases, identity revision, Mesh package/revision/digest/renderer kind, controller modes actually available, optional voice, scoped actor API, distribution permission/allowlist, and unresolved dependency. Leave unknowns explicit; no made-up IDs or endpoint names.

The owner lookup is implementation preparation, not a demand for CJ to answer another abstract identity question now. Inspect the existing local ecosystem first. If it cannot resolve a material distinction, present the exact owner records or missing package after completing independent work. This document itself does not claim that any of the new owner packages has been inspected or installed.
