# Two-home test — handoff for CJ (friend.9)

**Prepared 28 November 2026 for [Assignment 25](../reviews/2026-11-28-next-agent-assignment-25.md) N25-01. Result: pending human test.**

This is the one session [Review 23](../reviews/2026-11-28-friend-test-and-avatar-review-23.md) cleared: **CJ on the Mac, the friend on Windows, each at home on their own internet connection**, both on **friend.9**. Nobody needs a terminal, a source checkout, an owner app (Harbor, Mesh Avatar, music), a provider file or a server CJ runs. Online play seats no Avatar figure; the two people play each other.

## The two downloads (friend.9, code `977f14944cdb`)

| Who | File | Size | SHA-256 |
| --- | --- | --- | --- |
| The friend (Windows PC, 64-bit) | [Hapa-Versus-0.1.0-friend9-Windows-x64.zip](https://github.com/calderwong/hapa-verseUs-prototype/releases/download/v0.1.0-friend.9/Hapa-Versus-0.1.0-friend9-Windows-x64.zip) | 167,162,718 B | `83b3edb93f1b0ac154b66da08f6b6b1d38edb24a4a920f3876eb86eb7f1f2191` |
| CJ (Mac with Apple Silicon) | [Hapa-Versus-0.1.0-friend9-macOS-AppleSilicon.dmg](https://github.com/calderwong/hapa-verseUs-prototype/releases/download/v0.1.0-friend.9/Hapa-Versus-0.1.0-friend9-macOS-AppleSilicon.dmg) | 124,503,664 B | `91c0ae80adb69e12b51ab771472e55f1fdb0e67e88688d8cea9c07b423230879` |

Release page: [v0.1.0-friend.9](https://github.com/calderwong/hapa-verseUs-prototype/releases/tag/v0.1.0-friend.9) (pre-release, with `SHA256SUMS.txt`). **Help → About Hapa Versus** should show build `977f14944cdb` on both computers. A later commit on `main` carries small Avatar presentation fixes (Response 25); they are **not** in friend.9 and do not touch two-person online play.

## Message CJ can send the friend

> Here is the Windows test build of Hapa Versus: https://github.com/calderwong/hapa-verseUs-prototype/releases/download/v0.1.0-friend.9/Hapa-Versus-0.1.0-friend9-Windows-x64.zip
>
> 1. Right-click the zip → **Extract All…** → open the folder → double-click **Hapa Versus.exe**. It isn't signed yet, so Windows may say "Windows protected your PC": click **More info** → **Run anyway**. If a firewall question appears, note what it asked and what you chose.
> 2. Choose **Play online** and type a name.
> 3. When my name shows up, I'll **Challenge** you; press **Accept**. (If we can't see each other, I'll send you an invitation: paste it in the invitation field and press **Join by invitation**. It lasts 5 minutes.)
> 4. Plan your orders and press **Ready** once each turn. Play until the game ends, or concede from the menu.
> 5. Afterwards: quit the app, reopen it, and check your name and the result are still there. Then in **Play online** press **Copy connection report** and send it to me, along with any security prompts you saw.

## Steps for the session

1. **Install.** CJ opens the DMG, drags Hapa Versus to Applications and opens it. On first launch, macOS may need **System Settings → Privacy & Security → Open Anyway**. The friend follows the message above. Each person notes the exact prompt text they saw.
2. **Connect from two homes.** Both choose **Play online**. Either:
   - **Challenge/Accept:** CJ challenges the friend from the list.
   - **Invitation:** CJ presses **Open a table → Copy invitation** and sends it by message; the friend uses **Join by invitation**.
3. **Play.** Each person controls their own side and presses **Ready**. Play to a legal finish or a concession.
4. **Check the result.** Both see the same result and the "result saved" message.
5. **Quit and reopen.** Both quit and reopen. Each should still have the same name and fingerprint, and the game should be in their history.
6. **Record.** Both press **Copy connection report**. CJ fills in one [evidence form](two-network-evidence-form.md) for the pair: computers/OS, file names and build shown in About, prompts, how you connected, fingerprints, the end and result, persistence after reopen, and both reports. The reports leave out addresses, keys and invitations. Do not add Wi-Fi names, IP addresses or screenshots of system settings.

Full player instructions: [Play with a friend](play-with-a-friend.md).

## Afterwards

- **If it fails:** the connection reports show the stage the attempt reached (`starting-discovery`, `finding-player`, `authenticating`, `negotiating`, `connected`) and its error; for a problem after connecting, say which step of play, result or reopen went wrong. That observed stage chooses the next repair. Don't retry with another build first.
- **If it passes:** record the exact builds and outcome on the form. The next work is CJ's gameplay and visual feedback.
- Hand the filled form, or its public-safe summary, to the coding agent for the next response. Raw reports stay private unless CJ chooses to publish a redacted copy.

| Outcome | Status |
| --- | --- |
| Handoff prepared (this page) | Done |
| Ordinary downloaded launch and prompts on the actual Mac and Windows PC | **Pending human test** |
| Two-home game, matching result, quit/reopen persistence | **Pending human test** |
| CJ acceptance | Pending |
