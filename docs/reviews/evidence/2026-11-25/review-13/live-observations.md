# Fresh local UI observations — Review 13

**Date:** 25 November 2026, America/Los_Angeles.  
**URL:** `http://127.0.0.1:5199/versus.html`.  
**Setup:** human A, heuristic bot B, seated Red, seed 1, profile `hapa_open_10x9_v3_07`. No own-track contribution was added by the reviewer.  
**Identity limit:** the visible UI did not identify the running Git commit. Source conclusions elsewhere use the pinned repository; these observations describe this live instance.

The reviewer opened a separate game tab through the connected local browser, used rendered controls and DOM geometry, and inspected screenshots during the session. No hidden application state, owner stores or audio internals were read. This text record contains no fresh screenshot uploads.

| Step | Observed result |
| --- | --- |
| Prepare the fresh match | Music ready, three songs, Play music, 0:00. Seated Red and the new scene were visible. |
| Press Play once; open Music | The player showed Music ready, Paused, Play music and 0:00. This is the first-press startup problem reported in R13-02. |
| Press Play again; open Kept | A roughly one-minute table track started; the UI advanced from 0:00 to 0:01 and displayed Pause. Kept showed three playable recordings with offline availability and introduction counts. |
| Play an existing Kept recording | Replay mode, Kept ✓ and Return to table mix were visible. Time progressed on a roughly four-minute retained recording. No Keep action was needed to replay it. |
| Inspect at 1440×900 | The player and collection were usable. The ordinary Home composition was dominated by large flagstone seams and green patches. The coast was not clearly established in the usual frame. This last statement is a visual judgment. |
| Change response controls briefly | Expressive and Still states were exposed while playback time continued. The reviewer did not measure the resulting audio energy or prove every animated element stopped. Controls were restored to Subtle with Still off. |
| Return to table mix | The table recording resumed around 0:39/0:59, showing its Red introduction. This established a useful live saved-replay/Return journey. |
| Turn the camera 45° | An angled view made the table's cedar/brass apron and legs easier to read. This supports preserving its construction while refining Home. |
| Home at 700×900, drawers closed | Music region rectangle: x=247, y=61, width=440, height=112, right=687, bottom=173. The player covered Red's eyes/upper face. |
| Open Orders, then Music at 700×900 | Music rectangle: x=-85, y=61, width=440, height=112, right=355, bottom=173. The left transport controls and collection Play actions were clipped off-screen. |
| Finish | Closed the expanded panels, reset the temporary viewport override and closed the review tab. The pre-existing game tab was left alone. |

Original browser viewport was reported as 2838×1076; 1440×900 and 700×900 were temporary CSS viewport overrides. Device pixel ratio was not independently recorded. The UI tests do not imply a fixed screenshot baseline across devices.

## Scope boundaries

- Zero Keep/save actions or library/provenance writes were requested by the reviewer.
- Zero questions/messages were sent to Red.
- Zero Ready actions or match Ticks were advanced in this review journey.
- No owner services or additional local dev servers were started or stopped.
- No repeated restart/resource benchmark was performed; R13-05 uses source inspection and the author's disclosed measurement.
- The cause of initial Play was not inferred from unobserved storage. The source/fixture reproduction separately demonstrates the related intent-versus-status mismatch.

The browser activity was completed after cleanup. These observations support the bounded completion pass; they do not establish remote synchronization, fresh Keep success, deep digging, performance on arbitrary hardware, or CJ's visual acceptance.
