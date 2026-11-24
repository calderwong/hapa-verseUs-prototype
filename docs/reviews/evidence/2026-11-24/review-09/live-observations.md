# Independent live observation — Review 09

Observed on 24 November 2026 through the user's connected local browser, in a new temporary tab and match. The tab was closed after the review; existing user matches were not changed. This is a written observation record, not a scripted browser-regression result or a saved replay.

## Identity and limits

| Field | Observation |
| --- | --- |
| URL | `http://127.0.0.1:5199/versus.html?autostart=1&a=human&b=bot&seed=1&profile=hapa_open_10x9_v3_07` |
| Menu configuration | Profile v3_07, A human, B bot, seed 1; copied link includes the profile |
| Source identity | Not exposed in the running UI. Exact pushed source is independently reviewed at `2d8a5ff2a1c5686101b3dc3c2c8e0cee33c6df4f`; this does not prove the local server is running that commit. |
| Local dirty state / live engine checkout | Not recorded |
| Browser / OS | Connected Chrome browser; version and OS not recorded for this run |
| Viewport / DPR / text scale | Existing desktop viewport; no override used. Exact CSS size, DPR and OS text scale not recorded. |
| Camera | Home A overview, then close inspection of the selected Castle, then Return; exact numeric angles/zoom not recorded |
| Height | Surface opening; exact height-filter control value not separately recorded |
| Art | Existing local renditions; rendition index identity and asset hashes not recorded |
| Captures | Live screenshots were inspected during the session. No fresh reviewer screenshot file is included in this publication. |

## Connected sequence

1. The fresh match opened in Tick 1 planning with B controlled by the bot. The menu displayed the intended v3_07 configuration and a full profile-bearing link.
2. Through Parties & Cards, the reviewer selected A's Castle at R1C1. It had four members and 0 Supply. The navigator was closed before commanding.
3. The reviewer loaded the C1 2 of Wands as 2 Supply. The Move list quoted R2C1 at 1 Supply / 1 Tick with a Pawn join, and R3C1 at 2 Supply / 2 Ticks with absorption on the way. The latter was selected. The header showed A 2 orders / B 3.
4. One Ready moved through commitment/resolution into Tick 2 planning. There was no updated-plan acknowledgment wall or second confirmation.
5. The command bar showed Castle R2C1 with 1 Supply and Speed 1 per Tick; C1 was inactive for new orders. Close inspection showed nine members, the party still moving toward R3C1, and a 9/9 party count. The inspection and command surfaces remained separate.
6. Return restored the board view. One Ready for Tick 2, without an additional A order, resolved the continued route.
7. At Tick 3, the selected Castle was at R3C1 with 0 Supply. The reviewer opened History deliberately and selected the previous Tick's entries.

This is a successful ordinary opening through funding, two-Tick travel, Pawn absorption and inspection. It is not a live diagonal or Knight reproduction, a positive-Mana cast, or a whole-match test. Those distinctions are preserved in the main review's evidence table.

## Minor History wording observation

Tick 2's summary read **“Tick 2: 1 arrived · 2 Supply loaded.”** The detailed resource entries showed B loading 2 Supply from C8 into a Knight (now 2) and 2 Supply from C2 into a Knight (now 4). Thus the summary's 2 is the number of loading events, while the detailed total added is 4 Supply.

Source confirmation at the reviewed commit: `src/hapa/presentation/app.js:2055` builds the phrase using `count('supply_loaded')`. Review 09 records this as **R9-01, P3, deferred**. The observation does not establish a resource arithmetic error and does not reopen the completed repair assignment.
