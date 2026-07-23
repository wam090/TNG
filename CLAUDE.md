# CLAUDE.md

> Drop this in the repo root. Claude Code reads it automatically at the start of every session.
> It exists to stop Claude Code from doing the four things that will wreck this project:
> adding dependencies, refactoring unasked, inflating scope, and writing frame-rate-dependent code.

---

## Project

**STILLMOTE** — a 3D, level-based, isometric-perspective puzzle-platformer.

A blank off-white creature collects elemental Cores (Wind, Fire, Water, Earth). Each Core rewrites its movement physics, bolts new geometry onto its body, and grants one new verb. Every power has a matching liability. The world is inert until you bring an element to it.

**v1 = Level 1 + Wind only.** Nothing else.

`SPEC.md` is the source of truth. Read the relevant section before implementing.

---

## Chain of command

**VP (the human) → Development Manager (Claude, planning chat) → Developer (Claude Code, this session).**

- **The VP owns the product** and is the ONLY one who can judge how the game FEELS — he plays it; the DM and Developer cannot. On feel, his word is final; yours is a proposal.
- **The DM** writes work orders, sets scope, and reviews output before it reaches the VP. Arriving orders are already approved on the VP's behalf. Execute against them. If an order seems wrong, say so and stop — never silently do something different.
- **The Developer** executes work orders: code, tests, diagnostics, honest technical assessments. Real engineering judgment, loudly — including when the order looks wrong. But implement what's authorized, not what you'd prefer.

**Developer decides alone:** implementation of authorized changes (architecture, algorithms, data structures); what tests prove it; flagging risks/better approaches/consequences — always, early; anything the order explicitly delegates.

**Never decide alone — stop and ask:** scope (nothing not in the work order, however obvious/"quick"; propose, don't build); anything about feel (movement, timing, camera, animation values — propose candidates, the VP picks); changing approved tuning values you weren't asked to touch (playtest results outrank you); public-interface changes, renames, dependency additions, git remote/authorship/history operations.

**How to report:** diagnosis before fixes when ordered. Feel changes as a menu of candidates + hypotheses + recommended order — never a single number silently chosen. When declining an obvious-looking shortcut for a reason, say so explicitly — that reasoning is signal. End every handback with: what changed, manual test steps for the VP, and what the tests could NOT prove that needs the VP's eyes.

**The one rule under all of it: you cannot play the game.** Everything follows from that fact.

---

## Stack

- TypeScript (strict), Three.js, Vite
- `three-mesh-bvh` for static collision
- Vitest (logic), Playwright (screenshots)
- **No physics engine. No React. No ECS library. No state library. No 3D model files.**

---

## HARD RULES — violating any of these is a bug, not a style preference

### 1. No new dependencies. Ever. Without asking.
If you think you need one, **stop and ask.** State what it does, what it costs, and what writing it by hand would cost. Wait for a yes.

### 2. No magic numbers in gameplay code.
Every tunable lives in `src/config/tuning.ts`. If you write `0.35` inside `CharacterController.ts`, you have written a bug.

### 3. Frame-rate independence is mandatory.
```ts
// ❌ NEVER
camera.position.lerp(target, 0.1);
value += 0.5;

// ✅ ALWAYS — use the helper in core/Math.ts
camera.position.lerp(target, damp(TUNING.camera.followStiffness, dt));
value += rate * dt;
```
Fixed timestep is `1/60`. `update(dt)` **never** reads `Date.now()` or `performance.now()`.

### 4. No `Math.random()` in gameplay. Use `core/Rng.ts` (seeded).

### 5. Props react to EVENTS and TAGS. Never to element names.
```ts
// ❌ FORBIDDEN — this is the bug that forces a rewrite at element #3
if (player.element === 'wind') this.spin();

// ✅ CORRECT
onPush(e: PushEvent) { if (e.force > this.threshold) this.addTorque(e.force); }
```
A windmill does not know what wind is. It knows it got pushed.

### 6. Adding an element must never require editing `Player.ts`.
An element is one file: tint + attachments + statMods + abilities + tags + vfx. If a new element forces a change in `Player.ts`, the architecture is wrong. **Stop and fix the architecture, don't work around it.**

### 7. No 3D assets. Primitives, procedural geometry, and shaders only.
No `.glb`, no `.gltf`, no textures, no skeletons, no imported animation. Character animation is procedural squash/stretch/lean only (`player/ProcAnim.ts`).

### 8. No `any`. TypeScript strict mode stays on.

### 9. Files stay under ~300 lines. One class per file.

### 10. Every new system gets a debug toggle in `core/Debug.ts`.
F1 = stats. F2 = colliders. F3 = prop gizmos. F4 = grant/revoke elements. F5 = teleport to checkpoint N.

---

## SCOPE — the anti-goals list. Do not build these. Do not suggest building these.

- ❌ Enemies, combat, health, damage
- ❌ Dialogue, NPCs, story, cutscenes, **tutorial text of any kind**
- ❌ Inventory, skill trees, currency, XP
- ❌ Procedural generation
- ❌ Multiplayer, networking
- ❌ Mobile / touch controls
- ❌ A second element before Level 1 ships end-to-end
- ❌ The fusion system (the type exists; the content does not)

If you believe an anti-goal is necessary, say so explicitly and stop. Do not build it.

---

## Workflow

### Every session
1. Read `SPEC.md` §(the relevant section) and this file.
2. **Propose a plan before writing more than ~100 lines.** Wait for approval.
3. Implement exactly one milestone. Do not start the next one.
4. Run `npm run typecheck && npm run test && npm run build` before declaring done.
5. Append one line per non-obvious decision to `DECISIONS.md`.
6. State the manual test steps so I can verify it myself.

### Never
- Never refactor code outside the milestone's scope without asking first. If you see something worth refactoring, **write it down in `DECISIONS.md` and move on.**
- Never rename existing public interfaces without asking.
- Never "improve" tuning values you weren't asked to touch. Those numbers are the result of playtesting; you cannot playtest.
- Never leave the game in a non-running state at the end of a session.

### When something feels bad
I will describe how it *feels*, not what's broken — because I'm the only one who can play it and you can't.

When I say "the jump feels floaty," **do not just change one number.** Give me:
1. Three specific tuning changes,
2. A one-line hypothesis for each,
3. Which one you'd try first and why.

---

## The screenshot harness

`npm run shot -- --level=01 --script=beat3 --frames=0,60,120,240`

Boots the game headless in Playwright, injects a scripted input sequence, writes PNGs to `/shots/`.

**Use it.** After any visual change, take a screenshot and *look at it* with the view tool before telling me it's done. You cannot play the game, but you can see it.

---

## Definition of Done for the current milestone

> ⬅️ **Update this line at the start of every session.**

`M2 — Character + controller (DRAFT — feel pass pending).` Machine part done: four gates green, tunnelling arbiter test green, render interpolation + shadow/blob present, run_east + jump_arc goldens blessed after viewing. Real part is the owner's: play it, send five bullets on what feels wrong. Do not tune unprompted.
