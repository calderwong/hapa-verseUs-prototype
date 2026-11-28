# Response 25 evidence — 28 November 2026

Supports [Response 25](../../../2026-11-28-implementation-response-25.md) for [Assignment 25](../../../2026-11-28-next-agent-assignment-25.md).

**Code:** `fccb816e27d796424fcb470c052c045a4f8b5ce4` on main, on top of review publication `7b1a509`. **Human-test candidate:** unchanged, friend.9 code `977f14944cdb978a0ab456fc9878ddae4e72f78e`. No new executable was built or published; friend.9 does not contain this batch.

| File | What it shows | Limit |
| --- | --- | --- |
| [avatar-loading-test.txt](avatar-loading-test.txt) | `tests/hapa/avatar-loading.test.js` 2/2 on `fccb816`: delayed Falka load disposed (frame and listener 0 at once, frame told `dispose`, attach settles `false`), Leo replacement binds, late old `loaded`/`failed`/`playback` change nothing; bridge load settles once on dispose (`code: 'released'`); a never-settling renderer and a never-answering owner request still settle at dispose (request aborted); failure → retry control | Actual modules with a controlled DOM, frame messages and owner responses; no WebGL |
| Sabotage (recorded here) | The same test file run in a temporary worktree of `7b1a509` (friend.9 app sources): **0/2**, failing at `old frame removed at dispose` and `settled once, as a rejection` | Same controlled platform |
| [npm-check-summary.txt](npm-check-summary.txt) | One integrated `npm run check` on the coherent candidate: 203/203, two-process peer-verified match (`allAgreed`, same final hash), build | Docs edited afterwards; no test reads them |
| [n25-ui-journey.json](n25-ui-journey.json), [script](n25-ui-journey.mjs) | Real Vite dev page (`127.0.0.1:5199`, serving this checkout) driven through its own controls in headless Chrome with live owners (Harbor, Mesh Avatar node, music libraries): Chrome's accessibility tree names (`Play this game with Falka`, `Falka in my roster`, `… with no figure`, …); music wording for Red, No figure, Falka, Leo, Thor; started tables with Who is playing (Mesh figures "via Mesh Avatar's player node", Red "via Harbor"), and queues (Red's library only with Red); the V23-01 path in the page: Falka's `rig.json` held, so her frame stays loading, then a replacement match with Leo — 0 frames right after, old attach settled `false`, Leo bound with one frame, releasing the held request changes nothing, Ready Tick 1 → 2; no page errors | Browser dev page, not the installed app; the replacement is triggered through `startMatch` (what Start match calls), not a menu click; headless avoids background throttling |
| [setup-falka-chosen.jpg](setup-falka-chosen.jpg) | Setup panel with Falka chosen: compact rows, Details, No figure, "Falka brings no music, so only your library plays." | Setup only; table captures with owner art stay private |

Captures of the seated figures were taken and kept out of the public repository (private owner artwork).

## Reused, with their recorded scope

- Native readiness and re-authentication: [Response 24](../../../2026-11-27-implementation-response-24.md) (network code unchanged here).
- Relay carriage: [Response 23](../../../2026-11-27-implementation-response-23.md), run 46101799012, as re-judged by the exact-membership aggregator.
- friend.9 packages, Windows gate run 46124422768 and Mac installed reports: [friend.9 evidence](../friend-9/README.md), [Review 23 evidence](../review-23/README.md).
- Installed Red rendering and owner recovery: friend.5 journey (Response 22). The Harbor path changed only in cancellation and in the owner label.
