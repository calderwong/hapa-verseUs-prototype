# Avatar opponents and music discovery: proposed adapter contracts

**Version:** 1.0, 24 November 2026. Future design only. See the [product and implementation proposal](avatar-opponents-and-music-discovery-v1.md). These interfaces do not replace the current review or authorize a development run.

The names below describe a future host API. They do not claim an existing HTTP route, game plugin API, Harness operation or Avatar provider schema. The host continues to use the existing shared rules and PhaseAgreement.

## Data boundaries

~~~ts
type Seat = "A" | "B";

type DecisionRef = {
  matchId: string;
  sessionEpoch: number;                 // local instance fence, not gameplay state
  seat: Seat;
  controllerBindingRevision: string;
  avatarId: string | null;
  avatarIdentityRevision: string | null;
  tick: number;
  phaseId: string;                      // "plan" or exact yielded choiceId
  kind: "plan" | "response";
  requestId: string;                    // unique per admitted intent
  choiceId: string | null;
  decisionStateHash: string;            // stateFingerprint(authoritative state)
  inputHash: string;                    // immutable packet + permitted references
};

type PublicPlan = {
  revision: number;
  hash: string;
  commands: readonly GameCommand[];
  committed: boolean;
};

type DecisionRequest = {
  schema: "hapa.versus.decision-request/v1";
  ref: DecisionRef;
  manifestRef: {
    profileFingerprint: string;
    catalogFingerprint: string;
    rulesVersion: string;
    agreementPolicy: string;
  };
  inputPolicy: "tick_open_snapshot_v1" | "pending_choice_snapshot_v1";
  ownDraft: { revision: number; hash: string };
  observedPlans: { A: PublicPlan; B: PublicPlan };
  publicState: Readonly<PublicDecisionState>;
  request: null | Readonly<GameResponseRequest>;
  // Milliseconds are host policy; not authoritative game time.
  deadline: { budgetMs: number; expiresAtHostMs: number };
};

type DecisionReply =
  | {
      schema: "hapa.versus.decision-reply/v1";
      ref: DecisionRef;
      kind: "plan";
      commands: readonly GameCommand[];
    }
  | {
      schema: "hapa.versus.decision-reply/v1";
      ref: DecisionRef;
      kind: "response";
      answer: GameResponseAnswer;
    };

interface DecisionProvider {
  decide(request: Readonly<DecisionRequest>, signal: AbortSignal):
    Promise<DecisionReply>;
  cancel(requestId: string, reason: string): void | Promise<void>;
}
~~~

GameCommand and GameResponseAnswer mean the existing rules vocabulary, with a strict schema derived from its actual supported shapes. PublicDecisionState is an explicitly serialized public projection, not a reference to the mutable state. The host computes decisionStateHash before projection and binds inputHash to exactly what it sent. Request IDs and context sizes are bounded. No reply field carries executable code, tool authority or raw state patches.

A separate owned local broker should hold provider credentials and map the request to the exact permitted actor/model. Browser UI data should not contain a general provider token or a raw full-memory page. This broker is a future integration requirement, not permission to start a new service during planning.

## Single-consumption host state machine

Each request moves through admitted → pending → consumed OR cancelled. There is one terminal transition, and the admission ledger retains the accepted output digest. The transition is synchronous with selection/publication, not a check followed by an unguarded asynchronous gap.

1. Capture sessionEpoch, current match, controller binding, own draft, authoritative state hash and pending request; clone the exact allowed decision packet.
2. Produce and validate the heuristic fallback once for this request. Store it in the host ledger.
3. Dispatch at most one model call. Start the host deadline independently.
4. On reply, first require the complete echoed ref to match the active entry. Re-read current session/seat binding/Tick/phase/own revision/current pending choice and deadline. Ignore duplicate or expired replies.
5. Parse the exact bounded schema, then use the shared validator. On failure select fallback without extending the budget. On success choose the model result.
6. Atomically consume the request and publish the plan then Ready, or advance the pending generator once with the answer. Record exactly what was consumed and why. The adapter does not call the model again after Ready.
7. Cancel any remaining external work. A delayed cancellation receipt can update diagnostics but cannot reopen the request.

For an own-plan response, changing the *opponent's* still-editable plan does not cancel the already admitted sampled-input request under tick_open_snapshot_v1. Its observedPlans and inputHash describe the actual sampled input. Changing the own plan or using a deliberately different planning-input policy requires a new request; an old reply cannot overwrite the replacement. Once either seat has committed, its Ready remains governed solely by the profile's PhaseAgreement.

At response time use the exact pending choice and actual pool. A legal Pass is available without calling a provider. Candidate cards returned by responseOptions are not necessarily affordable. Reuse the game's response validation rather than inferring legality from list membership.

The local app can publish through its existing _publish path; the peer implementation uses signed records. The proposed request's decisionStateHash must not be confused with the existing peer record's priorStateHash, which is the Tick-opening hash even for later choices. Keep the new request fence in adapter transport/diagnostics initially. Any new peer payload/schema needs explicit negotiation/versioning and historical compatibility.

For future peer response intake, verify matchId, count, phaseId, priorStateHash, author binding and choiceId at the consuming boundary. The existing signature verifier authenticates bytes/identity; it does not make every payload appropriate for the current phase. Never rely only on the present _take predicate's count/type/choiceId matching.

## Separate public observer channel

~~~ts
type ObserverPacket = {
  schema: "hapa.versus.public-observation/v1";
  matchId: string;
  sessionEpoch: number;
  actorBindingRevision: string;
  audience: "local-viewer";
  display: {
    tick: number;
    mode: "planning" | "responding" | "playback" | "ended";
    shownThroughEventSeq: number;
    quantum: number | null;
  };
  viewHash: string;                     // digest of this view, never stateFingerprint
  facts: Readonly<DisplayedPublicFacts>;
  newlyShownEvents: readonly PublicGameEvent[];
  publicDrafts: null | { A: PublicPlan; B: PublicPlan };
  expiresAtHostMs: number;
};

type Reaction = {
  schema: "hapa.versus.reaction/v1";
  matchId: string;
  sessionEpoch: number;
  actorBindingRevision: string;
  utteranceId: string;
  basisEventIds: readonly string[];
  basedOnViewHash: string;
  text: string;
  requestedExpression: string | null;  // constrained owner-supported vocabulary
};

interface PublicObserver {
  observe(packet: Readonly<ObserverPacket>): void;
  cancel(scope: { matchId: string; sessionEpoch: number }, reason: string): void;
}
~~~

The observe callback must enqueue a bounded copy and return immediately. It must never be awaited by rules or Tick advancement. Use the event prefix actually revealed by _stepPlayback, not session.events, which already contains final events before playback finishes. Minting and public planning changes get explicitly typed observations; draft commands remain “planned.”

A social response has no path to DecisionProvider replies. Keep conversation/session scopes separate so new observer facts cannot leak into a controller request whose documented input is an earlier immutable sample. A reaction may quote public game facts by stable ID; it may not invent unseen events, costs or victory.

## Voice/actor lifecycle

~~~ts
type VoiceScope = {
  matchId: string;
  sessionEpoch: number;
  actorId: string;
  actorBindingRevision: string;
  utteranceId: string;
};

interface AvatarPresentation {
  presentIdentity(identity: Readonly<PermittedAvatarIdentity>): void;
  react(reaction: Readonly<Reaction>, signal: AbortSignal): void;
  stopVoice(scope: VoiceScope, reason: string): void;
  resetActor(actorId: string): void;
  dispose(): void;
}
~~~

Provider-specific speak/poll/bundle/cancel or performance-plan fields are resolved in the Avatar owner adapter. They must not be confused with game decision fields. Require a dedicated owned actor/session; do not broadcast generic motion to every Mesh window.

Generation, audio fetching, local play and provider job status are separate. Speaking and music ducking start on actual local playback. New match immediately fences later audio completion, cancels the provider job when supported, stops local audio and clears the actor. A “cancel requested” receipt does not establish backend quiescence.

## Non-blocking media consumer

~~~ts
interface VersusMedia {
  setPlaylist(reference: Readonly<OwnedPlaylistRevision>,
              signal: AbortSignal): Promise<MediaQueueReceipt>;
  play(): Promise<void>;
  pause(): void;
  skip(): Promise<void>;
  setGain(bus: "master" | "sfx" | "voice" | "music", value: number): void;
  saveTrack(reference: OwnedTrackRevision): Promise<OwnerSaveReceipt>;
  downloadTrack(reference: OwnedTrackRevision,
                signal: AbortSignal): Promise<OwnerDownloadReceipt>;
  transferTrack(reference: OwnedTrackRevision,
                target: ExplicitOwnerTarget,
                signal: AbortSignal): Promise<OwnerTransferReceipt>;
  subscribeStatus(listener: (status: Readonly<MediaStatus>) => void): () => void;
  dispose(): void;
}
~~~

These operation names are proposed facade names. Expose only those backed by the current owner's real contract/capability. An unsupported Transfer is unavailable, not simulated by saving a pointer or appending a game record.

All methods are called from media UI/background ownership. No music Promise is awaited by _newTick, _tryResolve, _resolveAgreed, resolveTick, closeTick, runTick or Peer.playTick. MediaStatus contains explicit states such as resolving, playable, buffering, playing, paused, unavailable, cancelled and failed; none is a game phase.

If a playlist change loses a race, its queueRevision/job ID must prevent the old response replacing the new queue. A user may choose to keep music across New match; retain that media session explicitly while still cancelling match-bound speech. On app disposal, unregister listeners and stop all owned playback. No transfer recipient is inferred from the opposing seat.

## Proposed bounded acceptance cases

| Case | Expected result |
| --- | --- |
| Duplicate valid model plan | One published plan and one Ready; second reply ignored. |
| Old request, identical board state | Rejected by request/session binding despite matching state hash. |
| Opponent edits after human Ready | Own commitment remains valid; no new click or forced drawer. |
| Model timeout during planning | Cached legal heuristic/empty plan committed; no indefinite wait. |
| Response arrives for previous choiceId | Discarded; no card or Mana spent. |
| Expired/malformed model output | One recorded fallback, no silent retries or partial plan. |
| New match during speech/inference | Old reply/audio/puppet cannot affect new session. |
| Playback paused before a casualty | Observer does not announce the future casualty; current speech stops. |
| Music source unavailable or transfer stalls | Game remains commandable and Tick continues normally. |
| Remote peer times out | Paused/protocol status, no fabricated concession or choice. |

These cases are proposed future checks. No implementation or tests were run for this document.

## Existing owner entry points to adapt

Read the pinned [source register](avatar-opponents-and-music-discovery-v1-sources.json), then refresh against the current local owner before coding. Addresses/ports are discovered owner configuration, not hardcoded match data. This table lists source-observed interfaces, not a promise that a local deployment or grant is available.

| Owner | Existing source interface | Integration boundary |
| --- | --- | --- |
| Builder identity | `GET /api/avatars/:id/mind`; `GET /api/avatars/:id/attach?target=motion-avatar` | Exact Avatar and permitted identity projection; retain source revisions. Do not infer identity from a display name or array index. |
| Builder voice | `GET /api/avatar-voices/:avatarId`; `POST /api/avatar-voices/:avatarId/speak`; `GET /api/avatar-voices/:avatarId/jobs/:clipId`; `GET /api/avatar-voices/:avatarId/bundle/:clipId`; `POST /api/avatar-voices/:avatarId/cancel` | Scoped owner consumer; namespaced request IDs and input digests. Local playback cancellation remains a separate action. |
| General Mesh | `POST /api/avatar/control`; `GET /api/player/events` | Current controls broadcast; they are not a scoped actor/session attachment. Do not connect a match to every open Mesh viewer. |
| Mesh Drive | `hapa.avatar-drive.v1` performance plan and the separate Drive player/server | Full-page, currently Red-specific path. Recover the shop's reusable performer or extract an owner-supported mount; preserve its framing/authentication boundary. |
| Builder music source | `GET /api/hapa-songs`; `GET /api/song-registry/dear-papa`; `GET /api/song-registry/songs/:id`; `GET /api/song-registry/audio/:id` | Current collection/local-source interfaces. Exact selected asset resolution, sanitized peer projection and neutral import are additional owner work. |
| Builder listening | `POST /api/echos/score-dust/sessions`; `GET/PUT /api/echos/score-dust/sessions/:id`; scoped guest endpoints | Reuse room-clock, base-revision and access patterns. Supported source kinds and process-memory session lifetime are current limitations. |
| Song Registry | Electron `window.hapa` IPC, including `loadRegistry()` and `appendHistory()` | No established Registry REST endpoint in the reviewed source. Durable retained-file import and general playlist revision ownership must be attached deliberately. |
| Overwind | Card reads/history/lineage through the existing authenticated `/v1/cards` contracts | Card metadata acknowledgements are separate from local asset acquisition. Do not manufacture origin authority from a discovery event. |

### Performer binding and supported vocabulary

The source-observed Drive plan is:

```json
{
  "version": "hapa.avatar-drive.v1",
  "text": "Good move. Let me try this.",
  "expression": "smile",
  "turn": 0.12,
  "gesture": "pinch",
  "wink": "none"
}
```

At the reviewed pin, expressions are `neutral`, `smile`, `concern`, `surprise`; gestures are `rest`, `pinch`, `thumbs-up`, `emphasis`; wink is `none`, `left`, or `right`. Text is bounded to 420 characters. Turn is normalized within ±0.6, not an angle in degrees. Refresh capabilities before using these values against a different package. Do not put match-control fields into this owner plan and assume the owner validates them: a separate envelope binds the plan to its admitted actor and operation.

A proposed `hapa.experience-participant.v1` binding contains `experienceId`, `sessionEpoch`, `role`, `actorId`, `avatarId`, `avatarRevision`, `rendererPackageRef`, `voiceRef`, `permittedMindRef`, and `bindingRevision`. Its role capability list is host-selected: a shop may attach Catalog actions; Versus may attach decision proposals and public observations. Embodiment alone grants neither role's actions. This common contract should stay small until it is proven with both hosts.

Require the voice bundle's `avatarId` and package/voice reference to match the active binding before audio adoption. The inspected Drive `adopt()` path does not establish this join. Do not weaken it into “name looks right.” Each performance returns scoped events: generation accepted, audio ready, local playback started, ended, stopped, or failed. Provider success and local audible playback remain different receipts.

## Proposed music owner contract

These are proposed semantic operations. The implementing owner may expose them through its existing IPC/HTTP adapter. No route below is being claimed as available today.

| Operation | Input/result commitment |
| --- | --- |
| `capabilities` | Returns the actual supported library query, playlist, offer, playback, retention and export operations, plus owner identity and schema versions. |
| `resolvePlaylist` | Resolves an explicit owner playlist and exact revision into sanitized ordered entry references. |
| `createOffer` | Resolves an exact selected recording/asset, hashes/freezes its descriptor, and returns a portable manifest plus separately scoped delivery locators/grants. |
| `saveDiscovery` | Idempotently commits a reference and encounter into an explicit destination collection; returns a durable reference receipt. |
| `retainAsset` | Admits a job for one manifest/asset and destination, under permitted capabilities and storage settings; returns an acquisition ID, not a completion claim. |
| `acquisitionStatus` | Reports received/verified bytes, provider state, stage, failure, and any final retention receipt. |
| `pauseAcquisition`, `resumeAcquisition`, `cancelAcquisition` | Persist job transitions; cancellation need not delete the useful reference. |
| `exportAsset` | Copies an already verified asset into an owner-managed export destination with the selected provenance format. |
| `setSharing` | Changes an explicit owner's seeding/offer policy. Keep does not invoke it implicitly. |

### Offer identity

```ts
type MusicOffer = {
  schema: "hapa.music-offer.v1";              // proposed
  manifestId: string;
  manifestRevision: string;
  issuer: { nodeId: string; publicKeyRef: string };
  recording: {
    id: string;                              // namespaced origin identity
    workId: string | null;
    title: string;
    durationMs: number | null;
    creators: readonly { id: string | null; name: string; role: string }[];
    sourceRefs: readonly string[];
  };
  assets: readonly {
    assetId: string;                         // sha256:<exact encoded bytes>
    byteLength: number;
    mimeType: string;
    role: string;
    codec: string | null;
  }[];
  cardRef: null | {
    canonicalId: string;
    revision: string;
    digest: string;
    aliases: readonly string[];
  };
  offeredCapabilities: {
    stream: boolean;
    retain: boolean;
    export: boolean;
    reshare: boolean;
  };
  termsRefs: readonly string[];              // explicit source assertions
  provenanceRefs: readonly string[];
  signature: {
    algorithm: string;
    canonicalization: string;
    signedPayloadDigest: string;
    value: string;
  };
};
```

This sketch identifies required distinctions, not a released JSON schema. Implementers must agree exact serialization, key resolution, signature verification and compatibility/version policy in the owning transport. Reject unsupported versions. Treat missing capabilities as unavailable; missing credits/terms remain unknown rather than inheriting collection defaults. Pin one chosen supported asset for playback/acquisition. Do not change it silently to another rendition under the same receipt.

Delivery grants are separate from public identity: bind the requester, issuer, asset digest, allowed operations, relevant session or acquisition, and grant lifetime. A resumable retention job needs a grant/renewal policy compatible with continuing after the match ends. A departed or revoked provider may be unavailable; the app must not claim it can force delivery. Already retained copies cannot be made to disappear by a network promise. Source terms and the receiver's seeding policy remain inspectable.

Provider locators contain only the bounded feed/drive version or ranges and supported transport references needed for the chosen asset. They do not export local absolute paths, private feed secrets or the owner's full library. Validate remote references at the native owner boundary; the browser cannot choose arbitrary filesystem destinations.

### Keep operation and receipts

At click time, freeze `{queueEntryId, recordingId, manifestDigest, assetId, introducingParticipant, destinationOwner, destinationCollection}`. Admit a unique client operation ID with an input digest. Reuse that ID only for retrying the same intent; changed input gets a new ID.

The owner can implement Keep as a recoverable composed operation, with `saveDiscovery` and `retainAsset` receipts independently visible. If reference saving succeeds and transfer admission fails, keep the reference and return the concrete reason. If the reply is lost, read the operation receipt instead of adding a duplicate row or starting another job. Retention should deduplicate storage by exact asset identity while preserving separate encounters.

An `Available offline` receipt must bind at least the acquisition, manifest digest, verified asset digest/length, destination owner, destination library record, committed retention state and completion time. Use owner-managed recovery across file/index publication. A streaming cache entry, browser download event, Card root acknowledgement or signed promise to send is insufficient.

Reference-only and pending states are valid outcomes. A temporarily disconnected destination may leave a durable queued intent, but the UI must identify that status and destination rather than report a library save it cannot confirm.

### Shared queue and clock

Use a dedicated media session with `mediaSessionId`, `controllerId`, `controllerEpoch`, `queueRevision`, immutable contribution entry IDs, `currentEntryId`, state, position and room start time. Queue/control operations carry a unique operation ID and expected revision. Old-controller and duplicate commands cannot reset a newer queue. Resolve conflict by reading current media state; do not replay the entire game.

Builder's current `baseRevision` and room clock are useful precedents, not proof these new fields already exist. Keep a clear initial controller; if failover is not implemented, preserve local listening and report shared control unavailable. Do not silently choose two competing leaders.

Listener gain, sound enablement, local mute and choice to follow another collection remain local. Pausing local audio does not mutate shared queue state. A local override should be visible, with a simple return to the shared track. Define buffering/skip policy at the room level, not through a game's Tick timer.

### Resource priority and lifecycle

Game interaction and finite decision work take priority over optional social generation, analysis and background retention. Bound pending voice reactions and transfer concurrency. Do not run a broad context-optimization or music-analysis loop merely because the match is open. Record cancellation status separately from confirmed backend quiescence.

Match-bound voice stops on reset. A retained music session may continue only through an explicit host lifecycle decision. Music-owner acquisition jobs survive the game view's disposal once durably admitted, unless the user cancels them. Unmounting Versus must unsubscribe its listeners without killing an independently owned library operation or leaking a stale UI callback.

## Evidence and handoff

These contracts are a design companion to the existing owner source, not authority to bypass owner policy, change an engine pin, begin paid inference, or expand an active implementation assignment. The current review remains the active handoff. When a milestone is assigned, compare current source against the registered pins and record attachment evidence at that integrated boundary. No implementation tests were run in preparing these documents.

