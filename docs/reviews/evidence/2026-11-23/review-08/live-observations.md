# Fresh local browser observations

**Date:** 23 November 2026, America/Los_Angeles.  
**Surface:** CJ's connected Chrome browser and existing local development server.  
**Source limitation:** The live menu named profile `hapa_open_10x9_v3_06`; no source commit or working-tree status was exposed. These observations do not establish exact parity with GitHub `f7c4f0f`.

The existing Hapa Versus tab used explicit `a=human&b=human`. It was read without changing the match. A separate temporary review tab opened:

`http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1`

## Observed journey

1. At Tick 1 the header showed A as the human, B had three planned orders, and the Ready button was available.
2. The match menu named v3_06, A human/B bot and seed 1. It offered all four controller combinations and stated that changing roles starts a new match. Its copyable link omitted the effective default profile, matching R8-03's source observation.
3. After Resume, one Ready click moved the UI to “Committed — resolving,” with a disabled resolving button. After playback it showed Tick 2/Planning. No acknowledgment button or forced Orders drawer appeared. A's plan was empty in this observed transition; this is not a claim that every order/response sequence was played.
4. Explicitly clicking History opened the optional Orders & history surface with History selected, Tick selection, and grouped movement/resources events. Tick 1 showed B's Supply loads and Castle/Pawn merge. Closing it returned to the board.
5. The Parties & Cards navigator showed two Queens and the central Commander. Selecting A's Knight R1C2 produced the compact command bar, visible Speed 2/Tick and the accurate no-Supply status.
6. Closing the navigator and choosing Inspect zoomed to the Knight. The screenshot showed compact member icon/value stacks for health, attack/reach and protection, with the small inspection strip and separate command bar. No large automatic details card covered the board.
7. The temporary review match was closed. The original match tab remained open and unchanged.

The screenshots used Chrome's existing wide desktop viewport; no viewport override was set. A separate viewport/device-pixel-ratio receipt, OS rendering/text scale and a pinned live asset index were not recorded. No fresh screenshot file is committed here; these are observation notes from tool-rendered live screenshots and DOM snapshots.

Not independently exercised in this live segment: positive-Mana burn/cast, bot Pause/Step/Stop, two-human opponent edits, roofed-member fallback definitions, all Knight shortcuts, a full game, network transport or mobile hardware. Source, focused diagnostics and submitted captures cover their stated portions separately.
