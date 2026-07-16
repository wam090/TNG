# STILLMOTE

A 3D, level-based, isometric-perspective puzzle-platformer. A blank off-white
creature collects elemental Cores — Wind, Fire, Water, Earth. Each Core rewrites
its movement physics, bolts new geometry onto its body, and grants one new verb.
Every power has a matching liability. The world is inert until you bring an
element to it.

## Why "STILLMOTE"

**STILL + MOTE.**

*Still* is the world. A dead, windless valley: windmills frozen mid-turn, seeds
unblown, everything grey-white and motionless. Level 1 is literally called
"The Still Yard".

*Mote* is you. A speck — a small, blank, off-white nothing, the same colour as
the dead world around it. At the start of the game you are just one more
particle of the stillness.

The name is the core loop in one word: **a mote of the stillness that learns
motion**. Every Core you collect converts stillness into movement — windmills
spin, updrafts rise, gates grind open — and the world only ever moves because
you brought motion to it. (When you pick up the Wind Core, a field of literal
motes begins orbiting your body: the first things in the world that move
because of you.)

## Run it

Requires Node ≥ 22.12 and npm ≥ 10.9 (enforced at install — older npm has an
optional-dependencies bug that breaks the build toolchain).

```bash
npm ci          # exact locked dependencies
npm run dev     # → http://localhost:5173
```

## Development

| Command | What it does |
|---|---|
| `npm run dev` | dev server with hot reload (level JSON included) |
| `npm run typecheck` / `test` / `lint` / `build` | the four gates — all must pass before a milestone is done |
| `npm run shot -- --script=idle --frames=0,60,120,240` | deterministic screenshot harness → `shots/` (`--debug` forces the overlay) |
| `npm run shot:check` | pixel-diff `shots/` against blessed goldens in `shots/golden/` |
| `npm run shot:bless` | promote current shots to goldens |

First time only, for the harness on a fresh machine: `npx playwright install chromium`.

**Debug keys:** `F1` stats overlay · `F2` collider wireframe · click anywhere =
copy `[x, y, z]` of the hit point to the clipboard (level-authoring tool).
Movement/jump arrive at M2.

**Docs:** `SPEC.md` is the single source of truth. `CLAUDE.md` carries the hard
rules for AI-assisted sessions. `DECISIONS.md` is the append-only log of every
non-obvious call made along the way.
