# Review 23 evidence — 28 November 2026

This packet supports [Review 23](../../../2026-11-28-friend-test-and-avatar-review-23.md) and [Assignment 25](../../../2026-11-28-next-agent-assignment-25.md).

**Reviewed main:** `29c7c1d466f94b5534fce1634f775a4df944a93f`. **Current release code:** `977f14944cdb978a0ab456fc9878ddae4e72f78e` (`v0.1.0-friend.9`). **Prior review publication:** `53aae50b6df520ff8340d6a81adaca1b3b1e1959`.

## Disposition supported

All three Review 22 findings close at their reviewed boundaries. Friend.9 is ready to attempt the bounded CJ Mac / friend Windows two-home human test. The newly observed pending-renderer cancellation gap and owner/music copy issues are optional follow-up and do not block human multiplayer. Consumer download/launch on the actual computers, independent-home success and CJ acceptance remain pending.

## Evidence levels

| Evidence | What it establishes | Limit |
| --- | --- | --- |
| [Selected source register](source-register.json) | 242 current source/test/harness/document/evidence files match the pinned Git blob hashes; SHA-256 and size recorded | Selected snapshot, not the full engine vendor tree or executable bytes |
| [Runtime probe](runtime/review-probe.mjs), [results](runtime/review-probe-results.json), [source hashes](runtime/source-register.json) | Three passing exact-source lifecycle groups: authenticated reconnect/standby before readiness, cancellation, finishing-authority replication | Real synthetic Ed25519/canonical dispatch, controlled feeds/transport/persistence/game loops; no native network or installed run |
| [Avatar probe](avatar/avatar-probe.mjs), [results](avatar/avatar-probe-results.json) | Single-choice closure, real module binding/retry/origin checks, bound disposal, and the reproducible pending-frame/listener cleanup gap | Controlled DOM, owner responses and frame messages; no private renderer/WebGL execution in this probe |
| Repository roster tests | 3/3 passed in the pinned snapshot | Focused state/owner-path tests, not full app/native qualification |
| Repository relay aggregator tests | 2/2 passed; both archived complete stages accepted and 13 negative mutations rejected | No new network experiment; retain old fixture scope |
| [Delivery verification](delivery/delivery-verification.json), [primary register](delivery/primary-source-register.json), [log excerpts](delivery/primary-log-excerpts.txt) | friend.9 tag/release/run/build alignment; actual current Windows package hash and six-report gate; submitted Mac reports match current artifact | Windows is a GitHub-hosted VM, Mac reports are producer execution evidence; neither is a two-home human test |
| [Fresh UI record](ui/observations.json), [setup capture](ui/setup.jpg) | Actual control-driven local preview: selection/reload/Start, visible Red/Falka/Leo/Thor, No figure/Leo/Thor Tick 1 → 2 | Live preview revision unverified; browser local play only; no installed/WAN or performance acceptance claim |

The primary Windows job is [140915741824](https://github.com/calderwong/hapa-verseUs-prototype/actions/runs/46124422768/job/140915741824). Both coordinating and delivery reviewers retrieved the decoded log; SHA-256 `ba2c1d2fffef1d4ac9b091468998d24c92f5bfb4c05607c75d06fa047181c00e` matched. The excerpts include actual digest/build/reopen/gate/upload lines and omit runner filesystem paths. The full log is not duplicated here.

## Reproduce the bounded diagnostics

Use matching source from the reviewed commit; provide that checkout's absolute path. The runtime and Avatar probes verify their relevant source hashes and intentionally refuse modified implementation bytes. They write their observation JSON beside the scripts; copy their folders to a temporary location before running if retaining the original evidence unchanged.

```sh
node docs/reviews/evidence/2026-11-28/review-23/runtime/review-probe.mjs /absolute/path/to/reviewed-checkout
node docs/reviews/evidence/2026-11-28/review-23/avatar/avatar-probe.mjs /absolute/path/to/reviewed-checkout
```

From the matching checkout root:

```sh
node --test tests/hapa/roster.test.js
node --test tests/hapa/relay-witness-aggregate.test.js
```

Node used: `v24.22.3`. The Avatar probe's published wrapper accepts a source-root argument and adds the recorded Git-blob assertions; its controlled behavior and output were compared with the original executed probe and match. Its assertions deliberately describe the reviewed pending-load defect; they are diagnostic evidence, not the expected contract for a corrected implementation.

## Reused evidence

- [Response 24](../../../2026-11-27-implementation-response-24.md): native readiness/re-authentication regression, reported sabotage result, 200/200 integrated check and friend.7 qualification.
- [friend.9 release evidence](../friend-9/README.md): current 201/201 reported check and submitted current Mac launch/invitation/Mesh journeys.
- [Response 23](../../../2026-11-27-implementation-response-23.md): actual controlled randomized-NAT relay carriage (run 46101799012). The new exact-membership aggregator re-judges that evidence; it does not require the topology to be rerun.
- Earlier installed Red recovery remains valid where its dependencies are unchanged. Short fresh live Red rendering is additional browser evidence.

Private owner artwork was inspected in the live preview but is not published here. Only the setup screen without owner artwork is included. Raw personal connection diagnostics, private keys, invitations and private owner stores are not part of this packet.

## Boundaries

No app source, engine pin, release binary or immutable standard bundle changed in this review. No CI was dispatched, no new relay/VPS deployed, and no independent desktop binary was executed by the reviewer. This review does not update or certify local Overwatch state, online Avatar hosting, Base Hapa Node conformance, two-home success or CJ acceptance.

