# STATUS — 2026-09-28 · WO-004 handback

**WO-004 is complete: Stages A–D. Stopped before Beat 3, as ordered.** M4b unit 1 (Beats 0–2, the Still Yard) is ready for the VP's play.

Branch: `claude/great-albattani-oqw1u0`, pushed. `origin/dev` was merged in first (`b45e4cf`); it added only `Claude outputs/WO-004.md`.
Git identity: **Wissam Mouhaidli <wmhaidly@gmail.com>**, from the latest VP commit (`b37e722` on dev). The merge commit `b45e4cf` was made a moment before the switch and carries the older name "Wissam" (same email). It was not rewritten.

| Stage | Commit | Gates at the boundary |
|---|---|---|
| merge origin/dev | `b45e4cf` | — |
| A — M4a close-out | `4a8dc19` | typecheck · 141 tests · lint · build · shot:check 29/29 |
| B — decision record | `9f7f6fe` | same, all green |
| C — preview pipeline | `2a57d0c` | same + `preview:smoke` passed |
| D — the Still Yard | `102df8c` | typecheck · **155 tests** · lint · build · **shot:check 35/35 at 0 px** · preview:smoke passed on build `102df8c` |
| handback (this file, evidence) | see `git log` | docs only |

Evidence frames and logs are in **`Claude outputs/WO-004-evidence/`**.

## Stage A — M4a close-out
- **A1 Gust reach.** `coneDeg` → `coneHalfDeg` 45 (±45°, PROVISIONAL; the VP's menu is 30 / 37.5 / 45). Reach is now measured to each pushable's bounds, not a single centre point. The DM's diagnosis was verified; one number was off (the fan).

  | Straight-on reach to the prop's visible edge | before | after |
  |---|---|---|
  | windmill | 4.99 m | **5.50 m** |
  | debris | 4.69 m | **5.50 m** |
  | fan | 5.12 m (DM estimated ≈5.4) | **5.50 m** |
  | spread | 0.43 m | **0.00 m** (a test holds it within ±0.1 m) |

  F3 now draws the gust wedge and flashes each pushable green (hit) or red (miss) → `A1c-F3-gust-wedge.png`.
- **A2 Shard.** It is now a violet (#9B4FD0) tetrahedron: not the Core's shape, not an element hue. **Frame for the VP's veto: `A2-shard-violet-tetrahedron.png`.** The red `accent` palette entry is retired. Palette audit note: `metal` sits in Wind's grey-blue family and `pillar` in Earth's ochre family, both at very low saturation. Flagged under B7; not changed.
- **A3.** The VP-approved sandbox values are marked in tuning.ts and DECISIONS. Ruling 1 (glide speed multiplier) and ruling 3 (safety cap clamps and counts) are accepted; ruling 4 (downward Gust) is deferred to Beat 5.

## Stage B — decision record
B1–B10 are recorded in SPEC.md (§1 colour language and anti-goals, §6.4 WindZone mass rule and playtest units, new §8.7 platform constraints, §10/§11/§12 release and preview), CLAUDE.md (hard rule 11: semantic actions only; anti-goals; DoD), and DECISIONS.md.
- SPEC §11 said "ship publicly at M7", which contradicted B2, so it was rewritten.
- Developer note on B8: at the fixed 60 Hz step the window is about 10.6 < F < 15.9, not 10.8 < F < 16.25, so the Beat 4 test must use the simulated terminal speed.

## Stage C — private preview
- `npm run preview:zip` → `preview/stillmote-<build>.zip`, with index.html at the zip root. It uses the system `zip`; no new dependency.
- `npm run preview:smoke` builds that zip, serves it from an itch-like subpath, and boots it headless (inside a 1280×720 iframe, and directly with `?debug=1`). It fails on any console error. **Result on `102df8c`: all 7 checks passed** → `C2-smoke-result.txt`, `C2-smoke-embed.png`.
- `?debug=1` opens F1 in production, and **F1's first line is the build id** (`vite.config.ts` → `.mjs`, so it can call git without `@types/node`).
- README has a new "Preview build" section.

## Stage D — M4b unit 1, the Still Yard
- **Spawn frame** shows the dead windmill, its shaft running to the closed gate in the cliff, and the Core on its pillar → `D1-spawn-frame.png` (and golden `level01_0`). A test projects each of them from spawn and checks they are in frame and unoccluded.
- **No void, no sequence break**, both tested:
  - The highest reachable feet height is 5.0 m (the windmill tower top plus a Wind jump). Every boundary is ≥ 5.5 m (cliffs 7, rails 6).
  - A grid flood fill with a headroom check shows no void anywhere, and **the gate is the only way to the Goal**.
  - The gate is capped by a lintel so nobody can stand on it.
- **Core pillar** is 1.2 m high. A base body lands on it with one normal jump (tested; this is also the `pickup` script).
- **Windmill** is 4.7 m from the pillar. Its bounds are within Gust reach from open ground and from the pillar top.
- **Camera-side boundary (my call):** a waist-high rail whose collision rises to 6 m, i.e. an invisible barrier above the rail. Two alternatives were rejected:
  - 6 m see-through bars caged the frame → `D1-rejected-tall-railing.png`.
  - A parapet over a lower terrace only moves the problem outward.
  - Pressed against the rail he stays visible → `D1-camera-side-rail.png`.
- **The camera never loses him on the critical path.** Raycast test at every step of `yard_chain`: at most the feet are hidden (6 steps dropping off the pillar's far side, 5 in the gateway). Frames: `D1-path-yard_chain_{81,130,175,220,248}.png`.
- **Temporary Goal** sits in the gateway. Anything behind the 7 m far wall is hidden from this camera, so the Goal fires as he crosses the gate line.
- **D2 shaft:** a windmill `shaftTo` field adds a visual shaft that turns with the rotor.
- **D3 prompt:** an E / X keycap beside the HUD slot, derived from Input.ts's bindings and the last-used device, shown from pickup until the first Gust → **frame for the VP: `D3-action-prompt.png`**.
- **D4:** the level01 scripts were recalibrated and `yard_chain` added. The 17 old level01 goldens were replaced by 23 new ones, all viewed.

## Manual test steps for the VP
1. `npm ci && npm run dev` → `http://localhost:5173` (the Still Yard). Controls: WASD/arrows, Space jump (press again while falling and hold to glide), E Gust.
2. **The yard, no instructions.** Does your eye go to the Core? Jump onto the pillar and take it. Does the E keycap appear? Gust the windmill (from the pillar top or the ground). Watch the shaft turn and the gate sink, walk through it, and the Goal fires in the doorway.
3. Walk into both near rails and try to jump over them: you stay visible, but there is an invisible barrier above the rail. Is that acceptable?
4. **Gust at ±45°:** try the windmill from off-angles. Does "inconsistent reach" feel gone? Press F3 to see the wedge and the hit/miss flashes.
5. `?level=sandbox`: F5 twice lands you next to the violet Shard. Veto it or keep it.
6. **Preview upload:** commit, `npm run preview:zip`, upload `preview/stillmote-<hash>.zip` as HTML5 on the itch.io page with visibility **Restricted**, 1280×720, fullscreen button, mobile-friendly, landscape (README → Preview build).
7. **iPhone Safari fps (B6):** open the preview on the phone, add `?debug=1` to the raw game URL, and read fps. I cannot do this from here.

## What the tests could NOT prove (needs the VP)
- Whether the yard's causal chain (windmill → shaft → gate) reads **without words**.
- Whether the Core **pulls him in from spawn**. It is small and grey-blue on a grey world.
- Whether **±45°** removes the "inconsistent reach" feel (the cone is still provisional).
- Whether the invisible barrier above the rails feels fair.
- The Shard's look, and the prompt's look.
- Frame rate on an iPhone.
- The phone raw-URL route (`?debug=1` on html.itch.zone) is documented but not verified against a live itch.io page.

## Open flags
- The temporary Goal sits in the gateway; it moves when Beat 3 is built.
- The floor extends 2 m beyond the rails before the sky; beyond that is visible but unreachable void.
- Out of scope, as ordered: Beat 3+, Gust/checkpoint VFX (M5), shard saving and the Level Complete card (M6), downward Gust, the WindZone mass-rule test (Beat 4).
- Unchanged: the `@vitest/mocker` moderate advisory (npm arborist bug); `@dimforge/rapier3d-compat` in node_modules (importing it is a lint error).
- The earlier playable artifact link still shows commit `832c303` (M4a). It can be republished with this build on request.
