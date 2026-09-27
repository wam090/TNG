# STATUS — 2026-09-27

Current milestone: **M4a — Abilities + props, sandbox only. BUILT; every DoD item met by test or harness. Awaiting the VP's play.**
Branch: `claude/great-albattani-oqw1u0` | author Wissam on every commit, `Co-authored-by: Claude` trailer | pushed
WO-003 commits this session: `9703f86` hard rule 5 · `1d40070` force-absorption finding · `fa6ffbd` M4a-A foundations · `8013b9e` M4a-B Gust/Glide/Windmill/sandbox · `04d2ff9` M4a-C the other eight props · this commit M4a-D (F5, goldens, SPEC, docs)

Gates (run this session, on the final tree): typecheck ✅ | test ✅ **139 passing** | lint ✅ | build ✅ | shot:check ✅ **29/29 goldens at 0 px** (17 existing untouched + 12 new sandbox goldens, regenerated from scratch before comparing)

## Ledger

| M | State | Hash |
|---|---|---|
| M0 – M3 | done | `ec77dfd` … `7b6ff85` |
| WO-003 housekeeping | done | `cecc1dd` `a18854b` `9703f86` |
| M4a Abilities + props (sandbox) | **built — needs the VP's play** | `fa6ffbd` `8013b9e` `04d2ff9` + D |
| M4b Level 1 layout | not started — `level01.json` untouched | — |

## M4a Definition of Done — evidence

| DoD item | Evidence |
|---|---|
| Gust + Glide work, lifecycle/cooldown tested | `GustAbility.test.ts` (windup, fires once, cooldown, aim, recoil, hit-stop only on hit), `GlideAbility.test.ts` (new-press rule, minAirTime, buffered-jump precedence, overrides, through the real Player), `AbilityRunner.test.ts` |
| All nine §6.4 props react to events/signals/overlap in `sandbox.json` | `props.test.ts` — one block per prop; harness: windmill → gate, debris → updraft → glide → ledge (checkpoint + shard), zone drift |
| Zero element names, zero tags in `src/world/props/**` | lint rule (proven to fire at WO-003) + grep: none |
| Hit-stop uses the pickup-dilation mechanism, MIN, tested | `core/TimeScale.ts` is the one mechanism; `TimeScale.test.ts` MIN test |
| Tunnelling arbiter re-run at computed worst case | worst case derived from tuning in the test: **≈35.6 m/s** (light mass, moveSpeed + zone terminal + full recoil, at max fall) → lands on the 0.1 m platform; raw diagonal sweep at the 55 m/s cap holds |
| `maxSpeedSafety` exists, in F1, never engages in designed play | 55 m/s; F1 line + red warning; tested (run/jump/max-fall: 0 hits); all three harness scripts end with `safetyCapHits: 0` |
| F3 gizmos, F5 checkpoint teleport | eyeballed via `npm run shot -- --keys=F3` / `--keys=F5,F5` (lands on cp_2 at [7, 6, −11]) |
| `level01` untouched | its 17 goldens are unchanged at 0 px |

## The WO-003 finding, resolved

Horizontal steering used to absorb every external force (a full wind pulse moved a standing player 0.43 m). The controller now has an **external-velocity channel**: pushes ride on top of steering and fade by `player.externalDrag`. With no pushes the behaviour is identical: all M2 tests pass and all 17 old goldens match at 0 px. Same pulse, drag 2.5: **~7.7 m drift** for the light body, 4.6 m for base.

## PROVISIONAL values — the VP picks (none of these have been played)

| Key | Now | Menu / note |
|---|---|---|
| `player.externalDrag` | 2.5 | 1.5 brutal · **2.5 first** · 4.0 gentle (drift 10.5 / 7.7 / 5.4 m per pulse) |
| `props.updraft.force` | 20 | 18 / **20** / 22 — must stay inside (16.56, 24) or the mass rule breaks (a test pins it) |
| `props.windmill.spinPerForce` | 0.5 | one Gust → 9 rad/s → signal ~0.7 s later |
| `props.gate.openTime` | 1.2 s | sink-open time |
| `props.fan.reach/width/height/force` | 14 / 4 / 4 / 9.5 | the current's size and push |
| `elements.hitStopScale` | 0 | SPEC "freeze"; a near-freeze (e.g. 0.05) is the softer option |

## Rulings still open (defaults in place, all logged in DECISIONS.md)

1. **`glide.horizontalDrag` 0.92**: read as glide speed = moveSpeed × 0.92. A per-step multiplier would depend on frame rate.
2. **`gust.coneDeg` 45**: read as the FULL cone (±22.5°). With 8-way keyboard aim that is a knife-edge for off-axis targets; ±45° is the forgiving reading.
3. **`maxSpeedSafety`**: it clamps AND counts (the DM said "detection only"). Count-only would let a mis-authored force tunnel through floors. It's a one-line change if wanted.
4. **Gust downward aim** (Beat 5's hidden shard) is unbuilt. How the player aims down is an M4b control/feel call.

## Open flags (unchanged)

- `@vitest/mocker` moderate advisory (npm 10.9.7 arborist bug) — toolchain call is the VP's.
- `@dimforge/rapier3d-compat` in node_modules via `@types/three`; importing it is a lint error.

## Awaiting the VP's eyes

Everything above is proven deterministic and correct against its rules. **Nothing proves any of it feels right.** In particular: whether a gust pulse *reads* as being blown off (drag), whether the updraft lift feels like riding air or like being winched (force 20, 9 m/s ceiling), whether glide's instant clamp to 3.2 m/s feels like a parachute snap, and whether a 45° cone is aimable.
