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
| `npm run preview:zip` | clean production build → `preview/stillmote-<build>.zip` for itch.io (see below) |
| `npm run preview:smoke` | builds the zip, serves it from an itch-like subpath, boots it headless, fails on any console error |

First time only, for the harness on a fresh machine: `npx playwright install chromium`.

**Controls:** WASD / arrows move · Space jump (while falling, press again and
hold to glide) · E Gust. On the Level Complete card, Space or E replays the
level from a fresh start.

**Debug keys:** `F1` stats overlay (shows the build hash) · `F2` collider
wireframe · `F3` prop gizmos + the last Gust's reach wedge · `F4` grant/revoke
the element · `F5` next checkpoint · in dev builds, click anywhere = copy
`[x, y, z]` of the hit point (level-authoring tool). `?debug=1` opens with the
F1 overlay on. `?level=sandbox` loads the disposable M4a prop sandbox.

## Preview build (private — itch.io, Restricted)

Builds go to a **restricted** itch.io page for playtesting from M4b onward.
Nothing is ever made public before the full game's Release step (SPEC §8.7, §12).

1. **Commit first.** The build id comes from git. An uncommitted tree gives a
   `-dirty` id and the zip command warns about it.
2. **Build and zip:** `npm run preview:zip` → `preview/stillmote-<build>.zip`
   (index.html at the zip root). Needs the system `zip` command.
3. **Optional check:** `npm run preview:smoke` boots that zip from an itch-like
   subpath inside a 1280×720 iframe and fails on any console error. It needs
   the system `unzip` command and saves the frame it saw to
   `preview/smoke-embed.png`.
4. **Upload** on itch.io: edit the project → *Kind of project*: **HTML** →
   upload the zip → tick *This file will be played in the browser*.
5. **Embed options:** viewport **1280 × 720** · **Fullscreen button** on ·
   **Mobile friendly** on, orientation **Landscape**.
6. **Visibility & access: Restricted.** Give testers access through itch.io's
   restricted-page options. Never choose Public.
7. **Which build is this?** Every build prints its commit hash as the first
   line of the F1 overlay. Testers quote it with their notes.

**On a phone (no F-keys):** open the embedded game's own URL — the `src` of
the game's iframe, served from `html.itch.zone` — directly in the phone's
browser and append `?debug=1` to get the stats overlay. (Not verified against
a live itch.io page from here; if a direct load is refused, the overlay can
still be opened on desktop with F1.)

**Docs:** `SPEC.md` is the single source of truth. `CLAUDE.md` carries the hard
rules for AI-assisted sessions. `DECISIONS.md` is the append-only log of every
non-obvious call made along the way.
