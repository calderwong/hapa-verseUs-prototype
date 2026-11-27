# Play Hapa Versus with a friend

The target is two people opening bundled apps on two computers and two internet connections.

**Candidate status:** [Review 21](../reviews/2026-11-27-lifecycle-and-delivery-review-21.md) requires a further reconnect correction before a dependable handoff. Friend.5 has passed a gated Windows runner check, including native startup, retained identity and a same-machine invitation/result journey; installed Mac Red recovery is also evidenced. Normal consumer downloaded launch and the separate-network human test remain pending. These are the intended player steps, not a claim that the full human journey passed.

**Current downloads:** see [Download and play](../../README.md#download-and-play) on the repository's front page. Each file names the computer it is for: **Windows PC (64-bit)** or **Mac with Apple Silicon** (M1 or newer). The intended Windows/Mac interoperability still needs a witnessed two-computer test.

## 1. Install on Windows

1. Download the Windows `.zip` file.
2. Right-click it → **Extract All…** → **Extract**. Open the extracted folder.
3. Double-click **Hapa Versus.exe**. (You can make a desktop shortcut to it; keep it inside its folder.)
4. This test build is not yet signed, so Windows may show **"Windows protected your PC"**. Click **More info**, check that the app is *Hapa Versus.exe*, then **Run anyway**. Record the actual prompts; this exact Windows launch path is not yet verified.
5. If Windows Defender Firewall asks whether Hapa Versus may communicate on networks, record the request and use the policy appropriate to the actual network. The required profile and successful connectivity must be verified on Windows; a firewall prompt alone does not establish a working route.
6. The game opens on its title screen. **Play on this computer** works without internet.

Your name, history and results are kept in your Windows profile (`AppData\Roaming\Hapa Versus`), not in the extracted folder, so you can replace the folder with a newer version later.

## 1. Install on a Mac

1. Download the `.dmg` file and open it.
2. Drag **Hapa Versus** into **Applications**, then open it from Applications.
3. This test build is not yet signed with an Apple Developer ID, so the first time macOS says it cannot verify the developer. To open it anyway: click **Done**, open **System Settings → Privacy & Security**, scroll to the message about Hapa Versus and click **Open Anyway**, then confirm. This manual-open path is an experimental exception and does not establish the normal downloaded launch target. Record the actual result. (Do not use Terminal commands to change security settings.)
4. The game opens on its title screen. **Play on this computer** works without internet.

## 2. Find each other

1. Both choose **Play online**. The app starts looking for players by itself. You can type a display name; it is only a label.
2. Either:
   - **Challenge:** when your friend's name appears in the player list, press **Challenge**. Your friend presses **Accept**.
   - **Invitation (if you cannot see each other in the list):** one person presses **Open a table**, then **Copy invitation**, and sends the copied text by message. The other pastes it into the invitation field and presses **Join by invitation**. An invitation lasts 5 minutes.
3. The panel shows what is happening (looking for the other player, checking who answered, agreeing the table). **Cancel** stops it; **Retry** tries again.

## 3. Play

- You each control your own side. Plan your orders, then press **Ready** once. When both are Ready, the Tick plays out.
- If the connection drops, the game says it is reconnecting. Nobody loses because of a dropped connection.
- Play until the game ends, or concede from the menu if you choose to.
- Both of you see the same result, saved on each computer. Quitting and reopening keeps your name, history and results.

## 4. If something goes wrong

In **Play online**, press **Copy connection report** and paste it into a message to CJ. It contains no passwords, keys, addresses or invitations. Also say which step you were on.

Please also fill in the short [evidence form](two-network-evidence-form.md) after you play (one per pair of players).
