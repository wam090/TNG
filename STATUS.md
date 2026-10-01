# STATUS — 2026-10-01 · WO-006 handback

**WO-006 is complete: Stages A and B. Stopped before Beat 5, as ordered.** M4b unit 3 is ready for the VP's play. The level now runs Beats 0–4 (the Still Yard, the Vent Court and the Crosswind Bridge) and ends on the card at the bridge's far end.

**Play it:** the STILLMOTE Playtest link is republished with this build (commit `f09a710`): https://claude.ai/artifact/JbzCorzyLesTKQQMbT9zNb

Branch: `claude/great-albattani-oqw1u0`, pushed. The WO was saved verbatim as `Claude outputs/WO-006.md` first. Git identity: **Wissam Mouhaidli <wmhaidly@gmail.com>** (latest VP commit `b37e722`).

| Stage | Commit | Gates at the boundary |
|---|---|---|
| WO saved verbatim | `0f61cdb` | — |
| A — glide prompt + VP approvals | `4e736de` | typecheck · 199 tests · lint · build · shot:check 46/46 at 0 px · preview:smoke passed |
| B — Beat 4, the Crosswind Bridge | `f09a710` | typecheck · **211 tests** · lint · build · **shot:check 60/60 at 0 px** (`--threshold=0`) · preview:smoke passed on build `f09a710` |
| handback (this file, evidence) | see `git log` | docs only |

Evidence frames and the smoke log are in **`Claude outputs/WO-006-evidence/`**.

## VP approvals recorded (2026-10-01)
These are now marked VP-approved in tuning.ts and DECISIONS (no longer PROVISIONAL):
- Gust cone ±45°;
- the card's fade 0.5 s, hold 0.6 s, fade to 85 %;
- the Vent Court visible from spawn;
- the court's invisible walls.

## Stage A — glide prompt
- **What it looks like:** the D3 keycap beside the HUD slot, showing the Jump binding from Input.ts (␣ on keyboard, A on a pad, following the last-used device). → `A-glide-prompt.png`
- **When it shows:**
  - An updraft reports when it starts lifting (`updraftLift`, a fact about the prop, never about who). That arms the prompt.
  - It appears on his first falling step after the column has actually lifted him, and goes on the step he first glides.
  - It shows once per run; a replay resets it.
- **Why "after it has lifted him":** he usually drops into the column from the plinth, so the lift starts while he's still falling. Without the rise requirement the prompt would flash before the ride.
- **Tested in the real level:** the exact show and hide steps in `vent_court`; it never shows in the yard; a replay re-arms it.
- **Look change:** at the D3 size the ␣ was a 6 × 4 px mark on the keycap's bottom edge, so this keycap draws it larger and lifted to mid-key. The E prompt is unchanged.

## Stage B — Beat 4, the Crosswind Bridge
**Layout:**
- The ledge continues east through an opening in the court's rail onto a sheltered **bridgehead** with the bridge checkpoint. Rail stubs funnel the way onto the deck.
- The **deck** is a 1.2 m-wide plank at y 6 over nothing.
- **Span A** (6 m) is exposed, then a walled **shelter nook**, then **span B** (6 m).
- The **far platform** has the Goal (Beat 5's start).
- The wind blows across the deck toward the camera, so being blown off reads as falling out of the screen.

**The numbers you asked for:**

| | |
|---|---|
| Zone force and window | **13.25**, the midpoint of the window measured at 60 Hz, **10.58 – 15.92** (PROVISIONAL). Menu: lower third ≈ 11.5 · mid 13.25 · upper third ≈ 15.0 |
| B8 mass rule (braced fully, terminal) | Wind drifts **+1.82 m/s** with the wind; plain body walks into it at **−1.09 m/s** |
| Timing margin | each exposed span takes **0.83 s** at Wind walk speed, **35 %** of the 2.4 s calm (1.57 s spare per span) |
| Leaving the bridge → fade | **0.38 s** blown off · **0.80 s** if he glides all the way down (target ≤ 1.0) |
| Counter aim | **WITH the wind** (toward the camera, down+left), or no stick while the wind carries him |

| WO constraint | Proof |
|---|---|
| 1 B8 mass rule | test with simulated terminal speeds (numbers above) |
| 2 Generous timing | test: each span ≤ 60 % of the no-force window |
| 3 Both solutions | `crosswind_timed` (wait out a gust, span A, shelter through the next, span B, Goal) and `crosswind_counter` (one mid-air Gust keeps him on through a full gust; the **same inputs without the Gust are blown off**, tested). → `B-counter-jump.png`, `B-counter-after-the-gust-recoil.png` |
| 4 The liability | `crosswind_blown`: walk on as a gust starts → blown off → respawn at the checkpoint. → `B-gust-hits-on-the-span.png`, `B-blown-off.png`, `B-respawn-fade.png` |
| 5 Fast fail | new `player.respawnDrop` 2.5 m below the **active checkpoint** (PROVISIONAL), no new prop; tested blown off and gliding |
| 6 No sequence break | tests: the zones cover the deck's full width and every reachable height; no other walkable surface; gliding under the bridge is caught within ~3.7 m; the bridgehead funnels onto the deck |
| 7 Visibility | the raycast test runs `full_run` (now the whole bridge) and the blown-off fall down to the fade |
| 8 Readability | tests: a telegraph before every gust, the haze in view from where he waits; deck 1.2 m, no rails. → `B-bridge-from-the-checkpoint.png`, `B-telegraph.png`, `B-gust-while-waiting.png`, `B-sheltered-through-a-gust.png` |
| 9 Goal at the far end | test; `full_run` covers Beats 0–4, card at 0:17.7 → `B-card-after-beats-0-4.png` |

**Found on the way (all fixed and tested):**
- **Missing funnel.** Walking east on the bridgehead off the deck's line missed the checkpoint and fell off its end, back to the Vent Court checkpoint (Beat 3 again). Rail stubs now funnel everyone onto the deck past the checkpoint.
- **Test sim.** The level test sim never moved the respawn point on checkpoints, which main.ts does. It now does too.
- **Respawn fade in harness frames.** It was only drawn in the real-time loop, so harness frames never showed it. It now shows.

## Please read: two findings about Beat 4
1. **The SPEC's counter is aimed the wrong way.** SPEC Beat 4 says "Gust *against* the wind". The recoil goes opposite the aim, so aiming into the wind throws him off faster. What works is: feather the stick into the wind, jump when about to go over, and Gust **with** the wind in mid-air. I recorded "with the wind" in SPEC's as-built note and left the original line for you and the DM to rule on.
2. **The mass rule is about terminal speed; a gust is short.**
   - The wind needs ~0.6 s to out-pull a full brace.
   - Holding the stick fully into the wind walks him off the deck's upwind edge first.
   - A near-perfect feather (into the wind only while drifting) lasts ~1.5 s of the 1.6 s gust and is then blown off. In my sweeps, exactly one feather setting rode out a whole gust at 13.25, and none did at 14.1 or above.
   - So the liability holds in practice. If the bridge feels too forgiving, the upper-third force is the lever.

## Manual test steps for the VP
1. Open the Playtest link → **Level 1, Beats 0–4**. Click the game once. Controls: WASD/arrows, Space jump (press again while falling and hold to glide), E Gust.
2. **Glide prompt:** in the Vent Court, after the column lifts you, a Space keycap appears beside the slot as you start to fall, and goes when you glide. *Do you notice it?*
3. **Bridge, cold:** walk from the ledge east onto the bridgehead (the pad is the checkpoint). Watch a few pulses: a faint haze warns, a brighter haze blows.
4. Walk onto the plank during a gust: you're blown off toward the camera and back at the pad in under a second. Does it read as "I'm too light"?
5. Cross by timing: go right after a gust ends, pause in the nook behind the wall, then the second span. The Goal is on the far platform.
6. **Find the second solution yourself before reading the answer in "Please read" above.**
7. Shortcut: F4, then F5 twice, puts you at the bridge with Wind.

## What the tests could NOT prove (needs the VP)
- Whether being blown off reads as **"I'm too light"**, not "the game cheated me".
- Whether the **counter technique is discoverable** (it means aiming *with* the wind, which runs against the SPEC's wording and maybe against instinct).
- Whether the **glide prompt is noticed**.
- How hard the wind should push (the force menu), and whether 0.4–0.8 s back to the pad feels right.
- Whether the telegraph haze (opacity 0.07, the M4a placeholder) is visible enough; the gust haze reads better.
- Whether ~75 s is right for Beat 4. The scripted crossing takes ~9 s from the checkpoint.
- iPhone frame rate, and the phone raw-URL route. Still not checkable from here.

## Open flags
- **Shadows:** the longer level makes the sun's fitted shadow map coarser everywhere. That's why every yard golden shifted by a few hundred shadow-edge pixels. A per-area shadow fit would be an M7 polish item; it's not done here.
- **The court checkpoint is behind you once on the bridge.** After the bridge checkpoint, dropping back into the court respawns you at the bridgehead.
- **Out of scope, as ordered:** Beat 5+, M5 VFX (wind streaks, rotor, checkpoint feedback), M6 shell.
- **Unchanged:** the `@vitest/mocker` moderate advisory; `@dimforge/rapier3d-compat` in node_modules (importing it is a lint error).
