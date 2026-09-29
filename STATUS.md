# STATUS — 2026-09-29 · WO-005 handback

**WO-005 is complete: Stages A and B. Stopped before Beat 4, as ordered.** M4b unit 2 is ready for the VP's play. The level now runs Beats 0–3 (the Still Yard and the Vent Court) and ends on the new Level Complete card.

**Play it:** the STILLMOTE Playtest link is republished with this build (commit `940405b`): https://claude.ai/artifact/JbzCorzyLesTKQQMbT9zNb

Branch: `claude/great-albattani-oqw1u0`, pushed. The WO arrived pasted by the VP and was saved verbatim as `Claude outputs/WO-005.md` first.
Git identity: **Wissam Mouhaidli <wmhaidly@gmail.com>**, from the latest VP commit (`b37e722`).

| Stage | Commit | Gates at the boundary |
|---|---|---|
| WO saved verbatim | `23d0c75` | — |
| A — Level Complete card | `f207e3a` | typecheck · 180 tests · lint · build · shot:check 36/36 · preview:smoke passed |
| B — Beat 3, the Vent Court | `940405b` | typecheck · **190 tests** · lint · build · **shot:check 45/45 at 0 px** (checked at `--threshold=0`) · preview:smoke passed on build `940405b` |
| handback (this file, evidence) | see `git log` | docs, plus one test bound tightened to its measured value |

Evidence frames and the smoke log are in **`Claude outputs/WO-005-evidence/`**.

## Process
The VP's "one git way" (2026-09-29) is in CLAUDE.md → Workflow:
- WOs arrive pasted and are saved as `Claude outputs/WO-NNN.md`.
- The only branch is `claude/great-albattani-oqw1u0`; `dev` and `main` are stale.
- Every handback updates STATUS, pushes, and republishes the Playtest link.
- The VP runs no git.

## Stage A — Level Complete card
- **The moment.**
  - The Goal freezes the sim through the one TimeScale mechanism: source `levelComplete`, scale 0, MIN rule, so it wins over any dilation.
  - The screen fades toward the level's sky colour, and the card comes in with it.
  - While the card is up, the sim gets no input.
  - → `A-card.png`, `A-card-mid-fade.png`
- **No words.** The card shows only:
  - a ring-and-check glyph;
  - a clock glyph + `m:ss.s`;
  - the Shard glyph + `found/total`, a row that is hidden when the level has no shards (level01 today; the sandbox shows it → `A-card-shard-row-sandbox.png`);
  - a replay arrow + the Jump keycap, shown after the hold. The keycap comes from Input.ts's bindings and follows the last-used device: keyboard `␣` (the visible-space sign, because the keycap must not say "Space"), pad `A`.
- **Timer.**
  - It is raw fixed-step time from the run's start to the Goal, stepped first each step by Game (new optional `RunFlow` part).
  - It never reads the wall clock.
  - It is tested over a full run that includes both pickup dilation and hit-stop: the time is exactly (Goal step + 1) × 1/60 s.
  - F1 shows it live.
- **Replay = a fresh load, by construction.**
  - New `core/LevelRun.start()` is the boot load AND every replay. It rebuilds the level from JSON, calls `Player.reset()` (rebuilds the controller, abilities, state machine and animation), and resets TimeScale, card, HUD, prompt, camera and the F5 index.
  - Tested: after a full run and a replay, the entire scene graph, the body, signals, shards, clocks and camera equal a fresh load's, and they stay equal step for step through a second full run.
  - The harness frame after a replay is byte-identical to a fresh load's.
- **Tuning** (new, all PROVISIONAL): `ui.levelComplete.fadeTime` 0.5 s, `holdBeforeInput` 0.6 s, and `fadeOpacity` 0.85. I added `fadeOpacity` because "toward the sky" needed an end value; the menu is 0.7 / 0.85 / 1.0.
- **Golden:** the card, now `full_run_700` (the Stage A golden `yard_chain_300` became the Beat 3 entry once the Goal moved).

## Stage B — Beat 3, the Vent Court
**Layout.**
- The court lies north of the yard, through the gate.
- The checkpoint `cp_court` is 2.8 m past the gate.
- The vent is debris on the updraft's grate: 3 × 12 × 3 m column, force 20, rise cap 9 m/s. It sits on a 1 m stone plinth, and the updraft listens to exactly the debris's signal.
- The ledge is a 6 m terrace along the north cliff, which is Beat 4's height. The Goal moved onto it.

| WO constraint | How it's met | Proof |
|---|---|---|
| 1 Entry through the gate + checkpoint | checkpoint just past the gate, reached before the vent | test (event order: pickup → Gust → checkpoint → Gust → Goal); `B1-entry-checkpoint.png` |
| 2 Visibility by layout | the yard's far wall **east of the gate is cut to a rail** (the unit-1 rail convention); tall stone only on the court's far sides (N, W); the gate frame slimmed (see below) | raycast test over the **whole Beats 0–3 path** incl. ride and glide: at most 1 of 5 body heights ever hidden, on **one** step; ride fully visible 89 steps, glide 57 · `B1-spawn-frame-court-over-rail.png`, `B1-gateway.png` |
| 3 No void in Beat 3 | court sealed to 16 m: cliffs, plus invisible collision above the rails and a railed cap on the gatehouse | test: a glide from the column top in **each of 16 directions** lands in the court or on the ledge; flood fill (gate open) finds no void on foot |
| 4 No sequence break | ledge 6 m; highest reach without the updraft 5.0 m (the windmill tower) | tests: static reach < ledge − 0.5; riding **without** gliding never makes the ledge (16 strategies) |
| 4 Wide margin | see the numbers below | test: glide range ≥ 1.5 × the gap |
| 5 Readability | choked vent on a plinth; placeholder column; ledge in frame from the grate | `B5-choked-vent.png`, `B5-open-column.png`, `B5-ledge-from-the-vent.png` + a test (≥ 2 m of the ledge's lip in frame and unoccluded from the grate) |
| 6 Goal on the ledge | Goal at (2, 6, −29.5) | test; `B-ledge.png`, `B-card-after-beats-0-3.png` |

**The glide margin (the numbers you asked for):**
- **Gap:** 10.0 m from the column's edge to the ledge's edge.
- **With the glide:** it carries **18.5 m** from the column top before his feet drop below the ledge height. That's 8.5 m to spare, **1.85×** the gap. Even leaving the column early (at 6 m) still lands.
- **Without the glide:** the best of 16 strategies drops through the ledge height 9.58 m from the vent centre. That's **1.9 m short** (1.6 m counting the body's radius).
- So the glide is *required*, which is my strict reading of "unreachable without the updraft + glide".

**Things I changed in the yard to get there (all tested):**
- **The far wall cut.** A 7 m wall hides ~9 m of whatever is behind it at this camera, so the wall east of the gate is now a rail with collision to 16 m. From spawn you can now see the choked vent over that rail (top right of the spawn frame). The windmill, shaft, gate and Core are still in frame and unoccluded (test).
- **Gate frame.** The 1 × 1.5 m east post hid him for ~0.25 s walking out of the gate, and the deep lintel hid his head. Both are now 0.4 m deep (0.3 m post). The lintel still caps the closed gate, and the gateway is now fully visible (in unit 1 his feet were hidden there).
- **A hole the flood fill found.** Cutting the wall opened a 0.55 m gap at the yard's NE corner, straight into the void. It is closed by extending the court's east rail.

**Harness:**
- `yard_chain` now ends on the Beat 3 checkpoint.
- New **`full_run`** runs spawn → card through all four beats: 10.0 s scripted, card golden `full_run_700`.
- New **`vent_court`** starts at the Beat 3 checkpoint. It uses a new optional script field, `setupKeys: ["F4", "F5"]` (grant Wind, teleport), which shot.mjs presses before stepping.
- Frames 0/20/72/150/240/300/400 cover: choked vent, open column, ledge seen from the grate, the ride, the glide, the landing, the card.

**Goldens:**
- The far-wall cut is visible from most of the yard, so all 24 level01 goldens changed. Each was viewed, then re-blessed.
- 9 are new.
- All 45 reproduce at 0 px.

## Correction to the WO-004 handback
It said "shot:check 35/35 at 0 px". That was wrong for the 4 sandbox `windzone_drift` goldens:
- They were blessed in WO-003, before the E keycap existed.
- Since WO-004, every run has drawn the keycap (that script never Gusts), and they passed at 876 px, inside the 0.1 % tolerance.
- They are re-blessed with the keycap. Every golden now reproduces at 0 px, and I checked with `--threshold=0`.

## Manual test steps for the VP
1. Open the Playtest link and press **The Still Yard + the Vent Court**. Click the game once. Controls: WASD/arrows move, Space jump (press again while falling and hold to glide), E Gust.
2. **Play it cold, without the notes.**
   - Core → windmill → gate.
   - Through the gate: the pad under you is the Beat 3 checkpoint.
   - Does the rubble on the raised vent say "blow this away"? Gust it. A faint column appears.
   - Hop onto the plinth, step onto the grate, and ride up.
   - **Do you find the glide yourself?** Without it you land short of the ledge, on the court floor. Walk back to the column and try again.
3. Land on the high ledge and walk into the pillar of light. **Does the card feel like an ending?** Note your time; SPEC §6.3's first-timer target for the whole level is 4–7 minutes, and Beat 3 alone ≈ 75 s.
4. On the card, press Space (or E): the level restarts exactly as fresh. Holding a key through the Goal does not skip the card.
5. **Try to break it:**
   - Glide off the column top in every direction. You should always come down in the court or on the ledge.
   - From the yard, try to jump the new far rail. There is an invisible barrier above it.
6. Shortcut: F4 then F5 puts you at the Vent Court with Wind. F1 shows the run time live.

## What the tests could NOT prove (needs the VP)
- Whether a first-timer **discovers the glide** (a second Jump press while falling) with no prompt. The ledge requires it, so if they don't, they are stuck in Beat 3.
- Whether the choked vent reads as **"blow this away"**. Its look is unchanged from the sandbox (rubble on a grate), only raised on a plinth.
- Whether the card **feels like an ending**: freeze, fade, and the glyph look. Its three timings are provisional.
- Whether seeing the court over the far rail from spawn **helps (desire) or distracts** from the Core in Beat 0.
- Whether the invisible walls sealing the court (up to 16 m) feel fair when gliding into them.
- Whether ~75 s is right for Beat 3. The scripted run takes 5.1 s from the checkpoint.
- Whether the ledge is visible enough from the vent. It is in frame, but at the top edge (`B5-ledge-from-the-vent.png`).
- The look of the `␣` keycap and of the replay arrow I added next to it (so the keycap reads as "again").
- iPhone frame rate (B6), and the phone raw-URL route. Still not checkable from here.

## Open flags
- The **Goal pillar catches gliders**. A glide into the 6 m light column above the ledge ends the level mid-air (M4a Goal behaviour). Fine for "done", but the VP should see it once.
- `Game.rng` is not reseeded on replay (no gameplay consumer until M5).
- Debug toggles (F2/F3/F4) keep their state across a replay.
- **Out of scope, as ordered:** Beat 4+, the crown rotor while gliding, streaks, checkpoint feedback and card flourishes (M5), and save/title/pause/level select/audio/settings (M6).
- **Unchanged:** the `@vitest/mocker` moderate advisory; `@dimforge/rapier3d-compat` in node_modules (importing it is a lint error).
