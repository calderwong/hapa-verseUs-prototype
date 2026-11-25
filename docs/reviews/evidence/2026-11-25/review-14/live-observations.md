# Fresh local UI observations — Review 14

**Date:** 25 November 2026, America/Los_Angeles.  
**URL:** `http://127.0.0.1:5199/versus.html`.  
**Setup:** new separate review tab; human A, heuristic bot B, Red enabled, seed 1, profile `hapa_open_10x9_v3_07`. No own tracks were added.  
**Identity limit:** the UI did not expose a running source commit. Pinned-source and fixture conclusions are recorded separately.

The reviewer used rendered controls, screenshots and read-only DOM geometry/hit testing. No hidden application state, Soundtrack API, renderer counters or browser storage were inspected or mutated. Viewports 1440×900 and 700×900 were temporary responsive-test overrides; they were reset before closing the review tab. No fresh screenshot is included in this publication.

| Step | Observation |
| --- | --- |
| Start at 1440×900 | Music prepared three table songs. The revised Home showed quieter paving, softer green treatment and a more legible warm table rim. The skiff/quay remained a small partly cropped far-edge cue. Art descriptions are reviewer judgments. |
| Press Play once | The first recording loaded at 0:00/0:59 and the button became Pause music. Later snapshots showed advancing time and ordinary progression through the table mix. Review 13's two-press startup did not recur. |
| Open Orders and Music on desktop | Both expanded, as permitted at the wider width. Selected History in Orders, Kept in Music, and filter `lantern`. |
| Narrow to 700×900 with both open | Both remained expanded. Music rectangle: x=13, y=61, width=259, height=112, right=272, bottom=173. Orders remained visible on the right; the selected compact one-panel composition did not reconcile automatically. |
| Close/reopen Music at 700×900 | Closing left Orders visible. Reopening Music collapsed Orders, while Kept remained selected and `lantern` remained in the filter. This proves the normal opening policy works and isolates the resize boundary. |
| Open Parties & Cards while Music is expanded | The navigator covered the left portion of the Music transport and collection, including Pause and row Play controls. Music remained expanded. |
| Read the Pause button center hit target | Pause rectangle: x=292..328, y=119..151, width=36, height=32. `document.elementFromPoint` at its center returned the NAV with aria-label `Parties and Cards`. `buttonOwnsCenter` was false. This read-only check establishes pointer occlusion. |
| Close roster/Music, open Red | Conversation opened normally. Entered the temporary unsent text `Review draft`. |
| Open Music, then reopen conversation | Music opening collapsed conversation and retained Kept/filter. Reopening Red collapsed Music; the textbox still contained `Review draft` and had focus. Cleared the textbox without sending it, then collapsed conversation. |
| Return to desktop; press Ready once | The game entered resolving, then reached Tick 2 / Planning. Music continued with the current recording and Pause shown. No repeated acknowledgement was requested. |
| Turn right 45°, then Home | The orbit showed cedar/brass rim, apron and legs with the board still clear. Returned Home after inspection. |
| Final closed Home at 700×900 | Music rectangle x=407..687, y=61..173, width=280. Red's facial features were clear and all primary transport controls were visibly on-screen. This supports closure of the old face-covering closed-deck placement. |
| Cleanup | Reset viewport override and closed the separate review tab. Existing user game tabs were left alone. |

## Action and evidence limits

- One Ready action advanced the fresh test match from Tick 1 to Tick 2.
- Zero Keep/save actions; zero conversation messages. The temporary draft was cleared.
- No services were started/stopped and no owner repository or library content was modified by the reviewer.
- No GPU/CPU-memory or performance measurement was performed in this live journey.
- The reviewer did not recreate a real browser audio refusal, await the complete final song, retune response modes or perform excavation. Those were not necessary to resolve the selected uncertainties.
- Device pixel ratio was not independently recorded. The observations describe these CSS viewport sizes, not an exact screenshot baseline across hardware.

The useful next fix is to run the existing composition policy when its inputs change, including the navigator, while retaining the state/focus behavior that already worked here.
