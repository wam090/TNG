# STATUS — 2026-10-28 · WO-008 + WO-009 handback (charter alignment; no game change)

**WO-008 and WO-009 are complete.** Docs and agent config only. Both orders were saved in `Claude outputs/` before the work.
- **WO-008:** the CEO's 22 Oct items.
- **WO-009:** the COO's tripwires directive of 22 Oct, acted on first when the session resumed on 27 Oct.

**What changed**
- **CLAUDE.md** follows WMD Charter v1 and WO-009: Who's who, Chain of command, the artist, the budget, the Drive routine, and tripwires T1–T6.
- **New subagent:** `.claude/agents/artist.md`. **reviewer** now also checks assets and blocks one that fails T3.
- **`ASSETS.md`** is the asset manifest (empty). **`.gitignore`** now ignores key files.
- **Asset services** (`Claude outputs/WO-008-asset-services.md`): **buy nothing now.** This replaces the 22 Oct log's "buy audio now".
  - Meshy Pro, $20 a month (75 SAR), only if the CEO's rule-7 ruling allows AI models.
  - ElevenLabs Starter, $6 a month (22.5 SAR), once he approves the style guide's audio section and a work order adds sound.
- **Until the CEO rules on hard rule 7:** no 3D generation, no 3D plan, no GLB tooling. Hard rule 7 and SPEC Decision 3 stay in force.
- **The game is unchanged**, so the Playtest link still carries the WO-007 build: https://claude.ai/artifact/JbzCorzyLesTKQQMbT9zNb

**Waiting on the CEO**
1. The WO-007 play-test, below.
2. The rule-7 ruling, on page one of the style guide (artist drafts it next).

**Waiting on the COO:** whether the Claude plan counts against the cap, and the session names (the CEO uses DevMan_v0.x; the directive says TNG_v0.x). No tripwire has fired.

---

## WO-007 handback (2026-10-22) — still waiting for the CEO's play

**WO-007 is complete: Stages A and B. Stopped after Stage B, as ordered.** The glide now shows: while he glides, a rotor unfolds on his crown and spins. This is the CEO's pick C, the M5 rotor pulled forward.

**Play it:** the STILLMOTE Playtest link, once it is republished with this build: https://claude.ai/artifact/JbzCorzyLesTKQQMbT9zNb

Branch: `claude/great-albattani-oqw1u0`. The WO was saved verbatim as `Claude outputs/WO-007.md` first (`3abf87d`).

| Stage | Gates at the boundary |
|---|---|
| A — test baseline (no game change) | 10 glyph-only goldens re-blessed; fresh regeneration: **shot:check 60/60 at 0 px** (`--threshold=0`) |
| B — the crown rotor | typecheck · **224 tests** · lint · build · **shot:check 60/60 at 0 px** (`--threshold=0`, from a fresh regeneration) · preview:smoke passed (on the uncommitted tree) |

Evidence frames are in **`Claude outputs/WO-007-evidence/`**.

## The CEO's 2026-10-21 playtest (Beats 0–4)
1. Being blown off feels fair: **approved**.
2. He didn't notice the gust warning haze.
3. He can't reach the Vent Court ledge, even when trying to glide.
4. The fast fail is quick: **approved**. `player.respawnDrop` 2.5 is now marked CEO-approved ("yes it's quick"). The bridge's wind force 13.25 stays PROVISIONAL: its strength was not judged directly.
5. He noticed the Space keycap but not what it does.

## The 2026-10-21 diagnosis of (3), from the sim
- A correct glide from the column top clears the ledge by 4.2 m.
- The column doesn't hold him at the top. He bobs between 14 m and about 4.5 m on a 3.6 s cycle, which leaves 0.45 s after the keycap appears to start a glide that still lands.
- A Jump press while still rising is ignored.
- W or D alone lands 0.5 m short.
- Holding a direction while entering the column takes him out of it below 3 m.
- Before this order, the glide was invisible.

**So the rotor makes the glide visible, but it does not widen the 0.45 s window.** That is what A and B below are about.

## Stage A — test baseline
- In this environment, 10 goldens differed from the WO-006 ones only inside text glyphs: the HUD's E keycap (7 frames, the same 26 px each), the ␣ keycap (vent_court_207) and the card's time digits and ␣ (crosswind_timed_620 and full_run_1150, at most 0.054 % of a frame). The code was unchanged.
- I viewed each diff and measured its region. Only those 10 frames were re-blessed. A second, fresh regeneration matched all 60 at 0 px, so the baseline repeats here.

## Stage B — the crown rotor
**What it looks like:** a pale see-through disc with three dark blades on a short mast on his crown, built from primitives. It reads against the grey court (→ `B-glide-vent-court.png`) and against the sky over the void (→ `B-glide-off-the-bridge.png`). The dark blades carry it against the sky; the pale disc adds area against grey.

**When it shows:**
- It shows only while he glides.
- It scales in over 0.15 s when the glide starts, and spins at 18 rad/s (time-based).
- If he lets go of Jump in mid-air, it scales back out over 0.15 s.
- On touchdown (a landing or a respawn) it is gone at once. A replay removes it until the next glide.

**Where it lives:** the Wind module plus tuning. It is a Wind attachment on the `crown` socket (`src/elements/wind/CrownRotor.ts`). Player.ts and every public interface are unchanged, and nothing checks an element.

**Values (all PROVISIONAL, in `tuning.wind.rotor`). Menus for the CEO:**

| | Now | Menu |
|---|---|---|
| Size (radius) | 0.5 m | 0.4 · 0.5 · 0.6 |
| Spin | 18 rad/s (≈ 2.9 turns/s) | 12 · 18 · 26 |
| Deploy / retract | 0.15 s | 0.1 · 0.15 · 0.25 |
| Colours | blades #2B3640, disc #EEF3F6 at 55 % | Wind's grey-blue family (an element effect) |

**Tests:** it shows only while gliding (every state checked); it scales in and out; touchdown hides it; the spin and deploy match at 30, 60, 120 and 144 Hz and with ragged steps. In the real level: on every step of vent_court and full_run, it is shown on every glide step and never on the ground. A glide off the bridge that ends in a respawn leaves no rotor at the checkpoint. After a replay there is no rotor until the next glide.

**Goldens:** only the two frames that catch him mid-glide changed: vent_court_240 and glide_updraft_280. In each, the only change is the rotor. Both were viewed, then re-blessed.

## Please read: two things about the rotor
1. **Touchdown hides it at once; it does not retract on landing.** The order says it retracts when the glide ends, and is never visible after a respawn. From where the rotor sits, a respawn looks exactly like a landing. Telling them apart would mean changing Player.ts. So the retract plays when the glide ends in mid-air, and on touchdown it simply goes. (On the respawn step the screen is fully black, so nothing shows there either.)
2. **A Gust in mid-glide makes it dip.** During a Gust the game reports "gust", not "glide", for 0.27 s, though the glide carries on. Following the order's rule, the rotor folds away, stays hidden for 0.13 s and comes back. Beat 5's mid-glide Gust will show this. Holding it out through a mid-air Gust is a one-line change. **I have not made it:** it is the VP's and CEO's call.

## Open, not picked
- **A:** the updraft holds him at its top.
- **B:** a Space press while still rising counts toward the glide.
- **D:** the glide prompt shows only while falling, pulsing.
- **E:** a brighter, blinking gust telegraph.
- Items 1–7 of the Dev Manager's 2026-10-20 report.

## Manual test steps for the CEO
1. Open the Playtest link → **Level 1, Beats 0–4**. Click the game once. Controls: WASD/arrows, Space jump (press again while falling and hold to glide), E Gust.
2. **Vent Court:** Gust the grate, ride the column, then press Space again as you start to fall and hold it. A rotor unfolds on his head and spins. *Does it read as "my body changed"?*
3. Let go of Space in mid-air: it folds away. Glide all the way down instead: it's gone the moment he lands.
4. **Crosswind Bridge:** walk onto the plank in a calm, jump off toward the camera, and glide. You see the rotor against the sky. When he drops through the fast-fail line he's back at the pad, with no rotor.
5. Optional: press E while gliding, and watch the rotor dip (item 2 under "Please read").
6. Shortcut: F4, then F5, puts you in the Vent Court with Wind. Press F5 again for the bridge.

## What the tests could NOT prove (needs the CEO)
- Whether the rotor feels like the payoff: "I pressed a button and my body changed shape".
- Whether showing the glide fixes (3). The diagnosis says the 0.45 s window is the deeper problem.
- The look: size, spin speed, deploy time, colours, and whether vanishing on touchdown feels better or worse than a retract.
- How the spin reads in motion. The frames are stills, and strobing on a slow device can't be seen from here.
- Whether the dip during a mid-glide Gust matters.
- iPhone frame rate. The rotor adds five small meshes, but this is still not checkable from here.

## Open flags
- **Unchanged:** shadows (the rotor casts none), the M4a test-fixture ring, the `@vitest/mocker` moderate advisory, and `@dimforge/rapier3d-compat` in node_modules (importing it is a lint error).
- **Out of scope, as ordered:** Beat 5+, the rest of M5, the M6 shell.
