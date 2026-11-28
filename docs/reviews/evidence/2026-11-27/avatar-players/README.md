# Falka, Leo and Thor at the table — evidence (27 November 2026)

CJ asked to play against Falka and Leo, then Thor too. All three are now served to Versus by their owner, **Mesh Avatar**, and can be chosen in **Play on this computer → Players**.

## Owner and identities

| Avatar | Roster id | Package (as served by the owner) | Renderer | Status |
| --- | --- | --- | --- | --- |
| Falka (alias Mimi) | `avatar-8` | `falka-human-assisted` 2026-11-17.1 · `falka-package.json` 6,891 B, SHA-256 `bf28b4121349160ee4100b0121522b7a9abdfb70742d8f42df6b99c0d6f456d7` | `human-connected-forward-mesh-r1` (2D forward mesh, WebGL2) | candidate |
| Thor / The Oranginal | `avatar-39` | `thor-feline-assisted` 2026-11-17.1 · `thor-package.json` 6,756 B, SHA-256 `098b39842406db74641775132b26b28c1554c7f4d8e47e80a203f4e8ea5cec30` | `feline-forward-mesh-r1` (2D forward mesh, WebGL2) | candidate |
| Leo / The Dig-Lamp | `avatar-46` | `leo-canine-assisted` 2026-11-17.1 · `leo-package.json` 6,694 B, SHA-256 `16fff911ae49dc0c3e5503022c5e986d8e9bb54d7b2de657d3006e7a4ccf6a33` | `canine-forward-mesh-r1` (2D forward mesh, WebGL2) | candidate |

Served by Mesh Avatar's own player node (`~/hapa-mesh-avatar`, `node server/api.mjs`, loopback 127.0.0.1:8860, read-only `/apps/player/falka|leo|thor/`; wrapper at `a50bb15`, the player directories link to the Falka r1 / Leo r1 work folders). Versus forwards only `/mesh/apps/player/(falka|leo|thor)/…` (no other owner path, no token) and checks the served package id, revision and Avatar id against its roster before seating the figure. Nothing of the owner is copied into Versus or the installer.

The owner's renderer resolves its files against the document, so it runs inside `mesh-frame.html` (base pointed at the owner's player directory): the same isolated frame bridge as Red — the page's own origin in the browser, the loopback frame origin `http://red.versus.localhost` in the desktop app (its CSP now allows a same-origin `base-uri`). The frame adds a gentle idle (breathing, blinks, small head turns, arm sway / ears and tail) and frames the figure into the seat.

Falka and Leo have **no voice** yet (captions only), **no music library** (your library plays) and play with the **heuristic bot** (the model-assisted controller is bound to Red). Human visual acceptance of the rigs is the owner's open item.

## Observed

- **Browser (Vite dev page, headless Chrome through the real setup UI):** each Avatar put in the roster, chosen, Start match → bound to the exact package above, drawn and animating at the seat, nameplate and greeting with its own name, controller "the heuristic bot (heuristic-bot/0.2.0), not a model", table music from your library, Tick 1 → 3, no page errors.
- **Desktop app (locally packaged test build, owners.json `{ "mesh": { "url": "http://127.0.0.1:8860" } }`, visible window):** `tools/hapa/desktop-mesh-journey.mjs` — both bound in the loopback frame (one performer), drawn, Tick 1 → 2, no keychain prompt ([json](desktop-mesh-journey.json)). The first desktop run failed with "Missing rig.json": the frame origin's `base-uri 'none'` blocked the base; fixed with `base-uri 'self'` and rerun.
- **Captures** of Falka and Leo at the table were taken and inspected but are **not published here**: this repository is public and their art comes from private Avatar Builder sources that stay with the owner (AGENTS media rule). They are kept locally with the owner's consent pending.
- **Thor** (added after friend.8): headless browser through the setup UI — bound, drawn, animating, Tick 1 → 3; packaged desktop test build — all three bound in the loopback frame, drawn, Tick 1 → 2, no keychain prompt ([json](desktop-mesh-journey-thor.json)). Thor's player relies on its page to size the canvas (Falka's and Leo's size it themselves), so the frame now sizes the owner canvas from the rig (760 × rig aspect); his "content" expression closes his eyes, so it is an occasional moment rather than constant.
- Thor released in [friend.9](../../2026-11-28/friend-9/README.md) (installed Mac journey with all three passed on the released DMG).
- Falka and Leo released in [friend.8](../friend-8/README.md) (installed Mac journey with Falka and Leo passed on the released DMG).
- Not done: online hosting of an Avatar player is still unbuilt.
