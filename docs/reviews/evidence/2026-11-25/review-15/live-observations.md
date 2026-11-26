# Fresh local UI observations — Review 15

**Date:** 25 November 2026, America/Los_Angeles.  
**URL:** `http://127.0.0.1:5199/versus.html`.  
**Setup:** separate fresh tab; human A, heuristic bot B, Red enabled, seed 1, profile `hapa_open_10x9_v3_07`; no own tracks added.  
**Identity limit:** the visible UI did not expose its running source commit. Source/fixture results are pinned separately.

The reviewer used ordinary controls and read-only DOM geometry/hit testing. No hidden app state, Soundtrack/camera API or renderer counters were read. Temporary responsive-test viewports were 1440×900 and 700×900; device pixel ratio was not independently recorded.

| Step | Observation |
| --- | --- |
| Desktop preparation | Orders and Music both expanded. One Play started music. Selected History in Orders, Kept in Music, and filter `lantern`. |
| Narrow directly to 700×900 | Orders became hidden automatically; Music remained expanded at x=247..687, y=61..173, width 440px. Filter value and focus remained intact. |
| Recording actions after narrowing | Both filtered Play button centers hit the respective buttons: x=264..320.56, approximately y=287.69..315.69 and y=385.81..413.81. |
| Open Parties & Cards | Roster became visible; Music collapsed automatically to the closed deck. The deck's six primary controls each owned their center hit target. |
| Formerly obstructed Pause | Pause rectangle x=449..483, y=119..151; center hit the button. A real click paused the song and showed Play music. |
| Resume and reopen collection | A real Play click resumed. Closing the roster and reopening Music retained Kept and `lantern`. |
| Conversation/Music round trip | Entered unsent `Review closure draft`. Music opening collapsed conversation and retained the filter. Reopening Red restored the draft and input focus. Cleared the draft without sending. |
| Desktop coexistence | Returned to 1440×900, opened the roster and Music with conversation already expanded. Roster, conversation and Music were all visible/expanded together. |
| Cleanup | Reset viewport override and closed the separate review tab. Existing user game tabs were left alone. |

The tested transport-center hit targets beside the roster were Previous, Pause, Next, Keep, Mute and Music. Previous was initially unavailable because nothing earlier had played; a clear hit target does not imply a disabled action should be enabled. The real Pause/Play clicks establish usable transport after the formerly failing transition.

## Action boundaries

- Zero Keep/save actions, zero Ready actions, zero conversation messages.
- The temporary unsent draft was cleared.
- No services, owner repositories or libraries were changed by the reviewer.
- No performance, CPU-heap or GPU allocation measurement was performed here.
- No new art pass, deep excavation, real browser activation refusal or historical gameplay matrix was exercised.

The two original layout failures did not recur. These focused observations support R14-01 closure and the recommendation to move the candidate to ordinary human playtesting.
