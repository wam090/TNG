# STATUS — 2026-09-27

Current milestone: **M4a — Abilities + props, sandbox only. NOT STARTED: blocked on one DM/VP ruling (below).** Zero props, zero abilities, no M4a code written.
Branch @ commit: `claude/great-albattani-oqw1u0` @ this handback's docs commit | author Wissam, `Co-authored-by: Claude` trailer
Commits this session:
  - `9703f86` WO-003: CLAUDE.md hard rule 5 now reads "Props react to EVENTS and quantities only. Never to element names or tags." (DM ruling 2)
  - this commit: DECISIONS.md correction entry + this STATUS

Gates (run this session): typecheck ✅ | test ✅ 55/55 | lint ✅ | build ✅ | shot:check ✅ 17/17 at 0 px. No game code changed; nothing blessed.

## Ledger

| M | State | Hash |
|---|---|---|
| M0 – M3 | done | `ec77dfd` … `7b6ff85` |
| WO-003 housekeeping | done | `cecc1dd`, `a18854b`, `9703f86` |
| M4a Abilities + props | **blocked — ruling needed** | — |
| M4b Level 1 layout | not started | — |

## The blocker

The M4a plan's envelope numbers (46.8 m/s worst case) were wrong in the opposite direction from what mattered. The controller's horizontal steering brakes any external force harder than a wind zone can push, so **on the real controller a full wind-zone pulse moves a standing Wind player 0.43 m, and Gust's mid-air recoil is gone in 0.22 s.** Beat 4 ("you get blown off the bridge") and Beat 5's self-boost shard cannot work with `applyForce` as built. Details and measurements: DECISIONS.md, "WO-003 CORRECTION".

Proposed fix (awaiting approval): a separate horizontal **external-velocity channel** in CharacterController. Forces and impulses feed it as F/m; it decays by its own drag; the player's steering never brakes it. With no external force it is bit-identical to today, so M2 movement and all 17 goldens are untouched. The drag value is a feel call for the VP (candidates in the handback).

Ruling (a) (per-zone ceiling at 40 m/s) is superseded by this: the drag bounds the zone at its source (terminal speed = F / (m·drag)). `maxSpeedSafety = 55` stays as a debug counter only.

## Open flags

- `@vitest/mocker` moderate advisory still open (npm 10.9.7 arborist bug; toolchain call is the VP's). DECISIONS.md "WO-003 OPEN".
- `@dimforge/rapier3d-compat` sits in node_modules via `@types/three`; importing it is a lint error.
- `glide.horizontalDrag 0.92` has no unit in SPEC §9; the default reading (glide target speed = moveSpeed × 0.92) needs a ruling before Stage B.
- SPEC §6.4 says Updraft applies +9 m/s *velocity* (mass-blind); the approved plan's test "lifts at mass 0.6, not 1.0" is mass-sensitive. The default is to follow SPEC. Needs a ruling before Stage C.

## Awaiting the VP's eyes

Unchanged from M3: the pickup-moment stub values (dilation, FOV punch) and Wind's stat overrides in play have never been judged by a human. Nothing new to play this handback.
