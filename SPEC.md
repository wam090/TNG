# SPEC.md — Project **STILLMOTE** (working title)

> Master design + technical specification. This is the single source of truth.
> Claude Code must read the relevant section before implementing it.
> If code and this document disagree, this document wins — or update this document first.

---

## §0. Read this before anything else

### 0.1 Assumptions I made on your behalf

| # | Your words | My reading | If I'm wrong, stop now |
|---|-----------|-----------|------------------------|
| 1 | "I want the charachter plane" | **Plain** — a blank, unformed, off-white creature. A blank slate that elements build onto. | If you meant an actual *airplane*, everything below changes. Say so. |
| 2 | "add to its body on collecting super tokens" | Elements **accrete** — the body physically gains parts. | — |
| 3 | "top angled view … not literally top" | Perspective camera, fixed yaw, ~38° pitch. Not orthographic. See §4. | — |
| 4 | "super tokens" | Code name `ElementToken`. Display name **"Wind Core"**, "Fire Core", etc. One rename constant. | — |

### 0.2 The one thing wrong with your brief

You described the elements **cosmetically**: *"he will turn grayish and wind is graphically surrounding him."*

That is a costume, not a mechanic. A costume gives the player no reason to cross the room to get it. If Wind only changes your colour, Level 1 is a walking simulator with a nice particle system, and you will lose interest in it within three weeks — because *you* will get bored playing it, and you are the only playtester you have.

**Every element must be a verb, and the level must be a lock built around that verb.**

Wind isn't grey. Wind is: *you become light, you glide, you push the world.* The grey and the swirling streaks are the **feedback** that tells the player their body rules just changed. The colour serves the mechanic. Never the reverse.

This is the difference between a tech demo and a game. Everything in §2 and §6 flows from it.

### 0.3 The three decisions that determine the whole codebase

**Decision 1 — Do elements STACK or SWAP?**

- *Swap*: you hold one element. Picking up Fire drops Wind. 4 states. Cheap. Forces swap-puzzle design.
- *Stack*: you accrete layers. 16 states, 6 pair-fusions (Fire+Wind = firestorm, Water+Earth = mud, Fire+Earth = magma…). Expensive. **This is what you actually described.**

**Ruling: build the architecture for STACK. Ship v1 with `MAX_ACTIVE_ELEMENTS = 1`.**

The loadout is an array from day one. The fusion table exists and is empty. Nothing about the code assumes a single element. When you're ready, you change one integer in `config/tuning.ts` and start filling in the table. This costs you ~2 hours now and saves you a rewrite later. Non-negotiable.

**Decision 2 — Levels are DATA, not code.**

You said "add levels later." If level geometry lives in TypeScript, level 4 will take you a weekend and you will quit. `level01.json` is a data file. `LevelBuilder` turns JSON into geometry + colliders. Adding a level = writing JSON. This is a 4-hour investment at M1 that pays for itself before Level 2.

**Decision 3 — Zero art pipeline in v1.**

No Blender. No glTF. No textures. No skeletons. No Mixamo. Primitives, procedural geometry, flat materials, shaders. Animation is **procedural squash/stretch/tilt only** (~80 lines).

Why: skeletal animation is where hobby 3D games die. The moment you need a rig, you need an artist, and you become blocked on a person who doesn't exist. A blank capsule with good squash-and-stretch outplays a badly-animated humanoid every single time. Look at *Journey*, *Rain World*, *Grow Home*, *Astro Bot*'s early prototypes.

---

## §1. Design pillars

Three sentences. Every future decision gets checked against them.

1. **The world is inert until you bring an element to it.** Windmills stopped, braziers cold, seeds unblown. You are motion.
2. **Every power is also a liability.** Wind makes you light — so wind zones blow *you* around too. Earth makes you heavy — so you can't glide. There are no free upgrades.
3. **No words.** No tutorial text, no dialogue, no HUD tips. If the player doesn't understand, the level is wrong.

### Core loop

```
See an obstacle you cannot pass
  → Find a Core (element token)
  → Your body changes: colour, shape, mass, verbs
  → The obstacle is now a puzzle, not a wall
  → Solve it → new space opens → new obstacle
```

### Anti-goals (each one has killed a hobby game — adding any before Level 1 ships is project-ending)

- ❌ No enemies, no combat. (Enemy AI + animation + balance = 3× scope multiplier.)
- ❌ No dialogue, NPCs, story cutscenes.
- ❌ No inventory, skill tree, currency, XP.
- ❌ No procedural generation.
- ❌ No multiplayer.
- ❌ No mobile / touch controls.
- ❌ No skeletal animation, no imported 3D models.
- ❌ No physics engine (Rapier/Cannon/Ammo). See §8.3.
- ❌ No second element until Wind is fully shipped and playable end-to-end.

---

## §2. The element system — the spine of the game

### 2.1 Structure

An element is **not** a colour. It is a bundle of:

| Layer | What it is | Wind example |
|---|---|---|
| **Passive stats** | Rewrites your movement physics silently. Player *feels* it before pressing any new button. | `mass 1.0 → 0.6`, higher jump, slower fall, more air control |
| **Active verb** | ONE new button. | **Gust** — a directed cone of air that pushes the world (and recoils you in mid-air) |
| **Hold verb** | A modifier on an existing button. | **Glide** — hold Jump while falling → slow descent, rotor deploys at the crown socket |
| **Tags** | What the world sees you as. | `light`, `air` |
| **Visual identity** | Body tint + meshes bolted to sockets + VFX. | Cool grey `#A9B4BC`, 3 orbiting streaks, mote field, crown rotor |
| **Liability** | The cost. | Wind zones blow you off bridges. Can't hold heavy pressure plates. |

Three things, one new button. That's the ceiling for a first element. Anything more and you're teaching, not playing.

### 2.2 The mass axis — the single best idea in this design

`mass` does one thing and it does it everywhere:

```ts
// A wind zone applies a FORCE. Force ÷ mass = acceleration.
acceleration = zoneForce / player.stats.mass;
```

- **Wind (mass 0.6)** → pushed 1.67× harder than baseline. Bridges become terrifying.
- **Earth (mass 2.0)** → pushed 0.5× as hard. Walks through a gale like it isn't there.

One float. One line of code. And it gives you, for free:
- Wind's liability (Beat 4 of Level 1).
- Earth's entire reason to exist.
- A puzzle category ("swap to Earth to cross, swap to Wind to climb") that carries you through ten levels.
- A reason for the *player* to think about what they are, not just what button to press.

Build the mass system in M2, before any element exists. It is the load-bearing wall.

### 2.3 Props react to VERBS, not to ELEMENTS

**This is the rule that makes the game cheap to expand. Violate it and you rewrite everything at element #3.**

```ts
// ❌ FORBIDDEN. If Claude Code writes this in a prop, it is a bug.
if (player.element === 'wind') this.spin();

// ✅ CORRECT.
onPush(e: PushEvent) {
  if (e.force > this.threshold) this.addTorque(e.force);
}
```

A windmill spins when something pushes it hard enough. It does not know what wind is. Later, a Fire explosion pushes it too — **for free, with zero new code**. That's the whole point.

Event types (declare all four in M3, even though only `push` is implemented):

```ts
interface PushEvent   { origin: Vec3; dir: Vec3; force: number; tags: Tag[] }
interface IgniteEvent { origin: Vec3; heat: number; tags: Tag[] }   // fire, later
interface SoakEvent   { origin: Vec3; volume: number; tags: Tag[] } // water, later
interface ImpactEvent { origin: Vec3; mass: number; tags: Tag[] }   // earth, later
```

Declaring the stubs now costs 10 minutes and forces the right shape.

### 2.4 The full element table (v1 = Wind only; the rest is the roadmap)

| Element | Mass | Passive | Active verb | Traversal | World interaction | **Liability** |
|---|---|---|---|---|---|---|
| **Wind** | 0.6 | Float, high jump, strong air control | **Gust** (cone push + air recoil) | Glide, ride updrafts, self-boost | Spin windmills, clear debris, push light blocks | Blown by wind zones. Too light for heavy plates. |
| **Fire** | 0.9 | Slight speed up, lights dark areas | **Burst** (radial flame + upward recoil) | Burst-jump, burn through vines | Light braziers, melt ice, burn barriers | Extinguished in water/rain zones. Can't touch fuses. |
| **Water** | 1.1 | Swim, immune to heat | **Flow / Freeze** | Swim, freeze water into platforms | Grow plants, fill basins, douse fire | Freezes solid in cold zones. Slow. |
| **Earth** | 2.0 | Immune to wind, breaks weak floors | **Pound** (shockwave) | Break floors, ride raised pillars | Heavy pressure plates, crush, shove boulders | **Cannot glide.** Sinks in water. Slow. |

Note how each liability is another element's strength. That's the swap loop and it's already solved.

### 2.5 Fusion table (DO NOT BUILD until all four elements ship)

| | Wind | Fire | Water | Earth |
|---|---|---|---|---|
| **Wind** | — | Firestorm | Ice Storm | Sandstorm |
| **Fire** | | — | Steam | Magma |
| **Water** | | | — | Mud |
| **Earth** | | | | — |

The type signature exists in M3 (`fusion: Record<string, FusedElement>` = `{}`). The content does not. Do not touch this until Wind, Fire, Water and Earth all ship. It is the single most seductive scope trap in this design.

---

## §3. The character

### 3.1 Chassis (built from primitives, procedurally)

- **Body:** capsule, radius `0.35`, total height `1.30`. Material: matte off-white `#F2EDE4`, roughness 0.85, metalness 0.
- **Head:** sphere, radius `0.28`, offset `+0.62` on Y. Same material.
- **Face:** one dark emissive visor slit, or two dark dots. That's it. (A face with expressions is an animation project. Don't.)
- **No arms. No legs.** Deliberate. Zero animation cost, and it makes the "adding to the body" fantasy *cleaner* — an armless blank thing that sprouts a wind rotor reads better than a humanoid getting an accessory.

### 3.2 Sockets — the morph system

The chassis is a rig of named anchor points. Elements bolt meshes onto them. This is the entire "morphing" architecture.

```ts
type SocketId =
  | 'crown'      // above head — rotors, flames, halos
  | 'head'
  | 'chest'      // core gem / element crystal
  | 'back'       // wings, shell, fins
  | 'orbitLow'   // waist-height orbital ring
  | 'orbitHigh'  // shoulder-height orbital ring
  | 'feet'       // ground contact FX
  | 'trail'      // behind, for motion trails
  | 'handL' | 'handR'; // reserved, unused in v1

interface AttachmentSpec {
  socket: SocketId;
  build: (ctx: BuildContext) => THREE.Object3D;
  animate?: (obj: THREE.Object3D, dt: number, s: PlayerRuntimeState) => void;
}
```

Adding an element = writing one file that returns tint + attachments + abilities + stat mods. **No changes to `Player.ts`.** If adding Fire requires editing `Player.ts`, the architecture is wrong — stop and fix the architecture.

### 3.3 Wind's visual build (your spec, made concrete)

| Element | Implementation |
|---|---|
| Body tint | Lerp `#F2EDE4` → `#A9B4BC` over `0.35s` on pickup |
| Orbiting streaks | 3 elongated thin boxes (or a swept `TubeGeometry`) on helical paths around `orbitLow`/`orbitHigh`. Additive blend. **Orbital speed scales with player velocity** — this is what sells it. |
| Mote field | `THREE.Points`, ~120 particles in a torus around the waist. Custom shader, additive, fade by age + distance. Drift lazily when idle, streak backwards when running. |
| Crown rotor | Appears **only while gliding**. A thin spinning disc/blades at the `crown` socket. This is the payoff moment — the player pressed a button and their body *changed shape*. |
| Gust FX | Expanding cone of streaks + a screen-space FOV punch + light camera shake. |
| Trail | Short-lived quads spawned at `trail` when speed > threshold. |

Whole thing lives in `elements/wind/WindVfx.ts`. One file. `spawn()`, `update(dt, playerState)`, `dispose()`.

### 3.4 Procedural animation (no skeletons, ever)

| State | Effect |
|---|---|
| Idle | Sinusoidal bob, `±0.03` on Y, period 2.2s. Slow rotation of orbit rings. |
| Run | Lean into velocity (up to 12°), slight yaw wobble, faster bob |
| Jump | Stretch: scale `[0.82, 1.22, 0.82]` |
| Fall | Slight stretch, head tilts down |
| Land | Squash: scale `[1.25, 0.72, 1.25]`, recover with spring stiffness `12` |
| Glide | Body pitches forward ~20°, rotor deploys, orbit rings flare outward |
| Gust | Recoil kick backwards, brief scale pulse |

Total: ~80 lines. It will look better than 90% of hobby 3D games. Trust this.

---

## §4. Camera

### 4.1 Choice: perspective, not orthographic

- **Orthographic isometric** (Monument Valley, Diablo): pretty, but destroys depth perception. In a game where you *jump*, players will constantly misjudge gaps. It is a playability killer for platformers.
- **Perspective at a high angle** (Super Mario 3D World, Captain Toad): keeps depth cues, keeps your VFX readable, still gives the "angled top" feel you described.

**Ruling: perspective, FOV 45, fixed yaw 45°, pitch ~38°, distance ~16 units.**

### 4.2 The bug you will hit and must not

With a fixed camera yaw, **movement must be camera-relative.** Pressing `W` moves you "up-screen," not along world +Z.

```ts
// Rotate input by camera yaw before applying it to the world.
const yaw = TUNING.camera.yawDeg * DEG2RAD;
const worldDir = new THREE.Vector3(inputX, 0, inputY).applyAxisAngle(UP, yaw).normalize();
```

Every isometric game gets this wrong once. Write it correctly the first time.

### 4.3 Smoothing — frame-rate independence

```ts
// ❌ WRONG — frame-rate dependent. Feels different on a 144Hz monitor.
camera.position.lerp(target, 0.1);

// ✅ CORRECT.
const a = 1 - Math.exp(-TUNING.camera.followStiffness * dt);
camera.position.lerp(target, a);
```

Put this in `core/Math.ts` as `damp(current, target, stiffness, dt)` and use it for **every** smoothed value in the codebase.

### 4.4 Other camera rules

- **Look-ahead:** shift the follow target `0.35 × velocity` so the player sees where they're going.
- **No camera collision in v1.** Instead, *design levels so the camera never clips.* Nothing between the camera and the player. This is a level-design constraint, and it's 100× cheaper than writing camera collision.
- **Yaw rotation (Q/E to spin 90°):** cut from v1. But because movement is already camera-relative, adding it later is ~20 lines.

---

## §5. Movement & game feel

This is the most important section in the document. **If the character doesn't feel good to move, nothing else matters and no amount of VFX will save it.**

### 5.1 The three things that separate "good" from "janky" — all mandatory in M2

| Feature | Value | Why |
|---|---|---|
| **Coyote time** | `0.10s` | You can still jump for 100ms after walking off a ledge. Without it, every missed jump feels like the game's fault. |
| **Jump buffer** | `0.12s` | Pressing jump just before landing still jumps. Without it, the game feels unresponsive. |
| **Variable jump height** | `lowJumpMult 2.2` | Releasing the button early cuts the jump short. Without it, jumping feels binary and heavy. |

These cost ~30 lines total. Games ship without them and feel bad forever, and the developer never knows why.

### 5.2 Additional feel rules

- **Fall faster than you rise.** `fallGravityMult: 1.6`. Real gravity feels floaty and terrible. Every good platformer cheats here.
- **Gravity is high.** `24 m/s²`, not `9.8`. Snappy, not moon-like.
- **Instant respawn.** Falling off = fade `0.18s`, respawn at last checkpoint. No lives, no death animation, no punishment. Rationale: faster to build, better for a kid, and the modern standard (Celeste, Super Meat Boy).
- **Hit-stop on Gust:** freeze the sim for `~40ms` on impact. Free impact.

### 5.3 Loop architecture

Fixed timestep, `1/60`, accumulator, max 5 substeps. `update(dt)` **never** reads wall-clock time. Never use `Date.now()` in gameplay. Never use `Math.random()` in gameplay — use a seeded RNG in `core/Rng.ts`.

---

## §6. LEVEL 1 — "The Still Yard"

### 6.1 Concept

A dead, windless valley. Windmills frozen. Seeds unblown. Everything is grey-white and motionless — *the same colour as you.* You are as inert as the world.

Picking up the Wind Core is the moment the world starts to *move*.

That is your theme and your mechanic and your art direction, in one sentence. It also retroactively makes "the character is off-white and blank" a **meaning** instead of a placeholder.

### 6.2 Structure — the Nintendo four-beat (Introduce → Develop → Twist → Test)

Do **not** improvise this. Improvised level design with an LLM produces mush. Build these six beats in order, playtest each before starting the next.

```
                                    ╔═══════╗
                                    ║ GOAL  ║  y=10
                                    ╚═══▲═══╝
                                        │
                        ┌───────────────┴────────────────┐
              BEAT 5    │  THE TEST — Spire Approach     │  y=6→10
                        │  fan → glide → mid-air gust    │
                        └───────────────▲────────────────┘
                                        │
                        ┌───────────────┴────────────────┐
              BEAT 4    │  THE TWIST — Crosswind Bridge  │  y=6
                        │  ~~~> WIND ZONE ~~~>  (it      │
                        │  blows YOU. you are too light) │
                        └───────────────▲────────────────┘
                                        │
                        ┌───────────────┴────────────────┐
              BEAT 3    │  DEVELOP — The Vent Court      │  y=1→6
                        │  gust the plugged grate →      │
                        │  updraft → glide to ledge      │
                        └───────────────▲────────────────┘
                                        │  [gate opens]
   ┌────────────────────────────────────┴──────────────────────────┐
   │  BEATS 0–2 — THE STILL YARD                            y=0    │
   │                                                                │
   │   ● spawn        ▲ pillar                  ✕ windmill (dead)  │
   │                  │ WIND CORE               ║                   │
   │                  ▲                         ║ shaft             │
   │                                            ▓ GATE (closed)     │
   └────────────────────────────────────────────────────────────────┘
```

---

**BEAT 0 — Silence (0:00–0:45). Teaches: movement, and desire.**

Flat enclosed yard. One gentle ramp. No hazards, no fail state, nothing to kill you.

In plain sight: a dead **windmill**, a visible **shaft/chain** running from it to a closed **gate** in the cliff. The causal chain is legible without a single word. The player will try to touch the windmill. Nothing happens.

Frustration is the teacher — but cap it at ~20 seconds. The Core is visible from spawn.

**BEAT 1 — The Gift (0:45–1:00). Teaches: the token.**

Wind Core on a low pillar, reachable with a single normal jump.

**Budget real polish on this moment.** It is the game's entire promise, delivered in 1.5 seconds:
- Time dilation to `0.25×` for `0.3s`
- White flash → body tint drives to grey over `0.35s`
- Streaks spiral in from off-screen and bind to the orbit sockets
- Camera punch in (FOV `45 → 41 → 45`)
- Ambient audio: a wind layer fades in that *was not there before*
- HUD element slot fills

Then, immediately and without being told, the player notices they jump higher and fall slower. **The passive teaches itself.**

**BEAT 2 — Introduce (1:00–1:30). Teaches: Gust.**

The windmill from Beat 0 is now 5 metres away. The player has a new button prompt (icon only — no words). Gust → windmill spins → shaft turns → gate grinds open.

Loop closed. Player has learned the entire core loop of the game in 90 seconds without reading anything.

**BEAT 3 — Develop (1:30–2:45). Teaches: Gust affects the world; the world affects you.**

Vent Court. A floor vent is choked with debris. Gust the debris → the vent erupts into an **updraft column** → jump in → you rise → **hold Jump to glide** across to a high ledge.

The rotor deploys at the crown. The player sees their body physically change shape mid-air. That's your "morph" payoff, delivered as a *reward for a verb*.

**BEAT 4 — TWIST (2:45–4:00). Teaches: the power has a cost. ← THE MOST IMPORTANT BEAT IN THE GAME.**

A narrow bridge, y=6, over nothing. A **wind zone** blows across it perpendicular to your path, in pulses (4s cycle: 1.6s gust, warning telegraph 0.6s before).

You are `mass 0.6`. **You get blown off.**

Two solutions, both discoverable:
1. Time your crossing between gusts.
2. Gust *against* the wind to counteract it, mid-air.

This is where the game becomes a game. It plants Earth (`mass 2.0`, immovable) years before Earth exists. It makes the player think about *what they are*, not just which button to press. It costs you a trigger volume and one line of `force / mass`.

If you build only one thing from this document, build Beat 4.

**BEAT 5 — Test (4:00–5:30). Combines everything.**

A three-part sequence, no new mechanics:
1. Gust a wall-mounted **fan** → it starts a horizontal air current across a chasm
2. Glide into the current → get carried
3. **Mid-glide**, Gust a second windmill on the far tower → the final gate opens before you land

Plus: **one hidden Shard**, off the critical path, reachable only by gusting *downward* mid-air to self-boost sideways onto a ledge. Rewards mastery. Teaches nothing required. This is where the joy goes for players who look.

**BEAT 6 — Goal.** A pillar of light. Walk in. Level Complete card: time, shards found (0/1). Save. Done.

### 6.3 Constraints

- **Target length: 4–7 minutes** for a first-timer. Not 20. If it's 20, you will never finish building it.
- **Tutorial text word count: ZERO.** Icons only. This is a discipline that forces the level design to be correct.
- **Fail state:** fall → respawn at last checkpoint in <0.5s. That's the only failure in the game.
- **Checkpoints:** at the entrance to Beats 3, 4, and 5.

### 6.4 Props needed for Level 1 (this is the complete list — do not build others)

| Prop | Reacts to | Emits | Notes |
|---|---|---|---|
| `Windmill` | `PushEvent` (force > 12) | `signal` on full rotation | Accumulates torque, decays. Visual spin speed = torque. |
| `Gate` | `signal` | — | Listens to signal id(s). `requireAll: true`. Grinds open. |
| `Debris` | `PushEvent` (force > 8) | `signal` on destroy | Blocks the vent. Despawns with a puff. |
| `Updraft` | `signal` (enable) | — | Trigger volume, applies `+9 m/s` vertical velocity, capped at height 12. |
| `Fan` | `PushEvent` | — | Toggles on; creates a directional `WindZone` in front of it. |
| `WindZone` | — | — | Trigger volume, applies `force / mass` horizontally. Pulses on a timer. |
| `Checkpoint` | player overlap | — | Sets respawn point. |
| `Shard` | player overlap | — | Collectible. Saves to profile. |
| `Goal` | player overlap | — | Ends level. |

Nine props. That's the whole level. Anything else is scope creep.

---

## §7. Level data format

```jsonc
{
  "id": "level01",
  "name": "The Still Yard",
  "version": 1,
  "spawn": [0, 2, 0],
  "env": {
    "sky": "#DCE7EE",
    "fog": { "color": "#DCE7EE", "near": 30, "far": 95 },
    "sunDir": [-0.4, -1.0, -0.3],
    "ambient": 0.55
  },
  "blocks": [
    { "type": "box",  "pos": [0, -0.5, 0],  "size": [30, 1, 24], "mat": "stone" },
    { "type": "ramp", "pos": [12, 0.5, 4],  "size": [4, 2, 6], "rotY": 90, "mat": "stone" },
    { "type": "box",  "pos": [6, 1.0, -8],  "size": [1.4, 2, 1.4], "mat": "pillar" }
  ],
  "tokens": [
    { "id": "core_wind_01", "element": "wind", "pos": [6, 2.6, -8] }
  ],
  "props": [
    { "type": "windmill",   "id": "wm_a",   "pos": [14, 0, -2], "rotY": 0, "emits": "sig_gate_a", "threshold": 12 },
    { "type": "gate",       "id": "gate_a", "pos": [20, 0, -2], "rotY": 90, "listensTo": ["sig_gate_a"], "requireAll": true },
    { "type": "debris",     "id": "deb_1",  "pos": [24, 0.5, -10], "emits": "sig_vent_1", "threshold": 8 },
    { "type": "updraft",    "id": "up_1",   "pos": [24, 0, -10], "size": [3, 12, 3], "listensTo": ["sig_vent_1"], "velocity": 9 },
    { "type": "windZone",   "id": "wz_1",   "pos": [30, 6, -18], "size": [14, 6, 4], "dir": [0, 0, 1],
                            "force": 9.5, "period": 4.0, "duration": 1.6, "telegraph": 0.6 },
    { "type": "fan",        "id": "fan_1",  "pos": [40, 6, -22], "rotY": 180, "threshold": 10 },
    { "type": "checkpoint", "id": "cp_1",   "pos": [24, 1, -10] },
    { "type": "checkpoint", "id": "cp_2",   "pos": [30, 6, -14] }
  ],
  "shards": [ { "id": "sh_1", "pos": [46, 9, -30] } ],
  "goal": { "pos": [50, 10, -34], "radius": 1.5 }
}
```

**Consequence:** Level 2 is a JSON file, not a code change. That was Decision 2 and it's why you make it now.

**Authoring aid (build in M1, it will save you many hours):** a debug mode where clicking in the world copies `[x, y, z]` to the clipboard, and the level JSON hot-reloads. Without this, hand-authoring JSON coordinates is unbearable and you will quit.

---

## §8. Technical architecture

### 8.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript, strict** | Types are what let an AI edit a codebase without silently breaking it. Non-negotiable. |
| Renderer | **Three.js** (latest stable) | Pure code, no editor, no binary assets. Claude Code can do 100% of it. |
| Build | **Vite** | Instant HMR. Your iteration loop *is* the project. |
| Collision | **three-mesh-bvh** + custom kinematic capsule controller | See 8.3 |
| State | Plain TS classes + a tiny typed event bus | No Redux. No ECS library. |
| Levels | **JSON** + `LevelBuilder` | See §7 |
| VFX | `THREE.Points` / `InstancedMesh` + GLSL | No particle libs |
| Audio | Howler.js (M6 only) | |
| Save | `localStorage`, versioned schema + migrations | |
| Tests | Vitest (pure logic) + Playwright (screenshots) | See 8.4 |
| Deploy | Vercel / Netlify / itch.io — static | |

### 8.2 Engines explicitly rejected

- **Unity / Unreal** — scene files are binary/YAML, the editor is the source of truth. Claude Code is effectively blind. **Reject outright.**
- **Godot** — a good engine, and the right answer if you later need console/mobile export. But `.tscn` scenes are edited via a GUI, and an AI editing them as text is guessing. Weaker Claude Code loop. Revisit at v2 if ever.
- **React Three Fiber** — genuinely viable, and you'd get `drei` + `rapier` cheaply. But it inserts a React reconciler between you and the render loop. For per-frame gameplay logic that's a tax and an extra debugging layer, and you are not a React developer. **Plain Three.js.**

### 8.3 No physics engine — deliberately

Rapier/Cannon give you rigid bodies you don't need and take away the precise control you *do* need. Platformers built on generic physics engines feel floaty, unpredictable, and impossible to tune. A kinematic capsule controller you own is ~250 lines, fully deterministic, and Claude Code can reason about it line by line.

**Approach:** merge all static level geometry into one BVH (`three-mesh-bvh`). Sweep the player capsule against it. Slide on contact. Raycast down for `isGrounded` + slope normal. Done.

Add a physics engine only if a future level genuinely needs stacked rigid bodies. It probably never will.

### 8.4 The screenshot harness — do this at M0.5, it's the highest-leverage 90 minutes in the project

**Claude Code cannot see your game.** That is the central bottleneck of this entire project. Every visual bug requires you to be the eyes, describe it in prose, and hope.

Fix it:

```bash
npm run shot -- --level=01 --script=beat3 --frames=0,60,120,240
```

Playwright boots the game headless, injects a scripted input sequence, screenshots to `/shots/*.png`. Claude Code then reads the PNGs directly with its `view` tool and **sees what it built.**

This turns a 5-minute human-in-the-loop cycle into a 30-second autonomous one. Almost nobody does it. Do it.

### 8.5 Folder structure

```
src/
  main.ts                      # bootstrap
  core/
    Game.ts                    # fixed-timestep loop, state machine
    Time.ts  Input.ts  Events.ts  Rng.ts  Math.ts  Save.ts  Debug.ts
  config/
    tuning.ts                  # EVERY magic number in the project
    elements.ts                # element registry (data only)
  render/
    Renderer.ts  CameraRig.ts  Materials.ts  Postprocess.ts
  world/
    Level.ts  LevelBuilder.ts  Collider.ts  Signals.ts
    props/
      Prop.ts  Windmill.ts  Gate.ts  Debris.ts  Updraft.ts
      Fan.ts  WindZone.ts  Checkpoint.ts  Shard.ts  Goal.ts
  player/
    Player.ts                  # entity: loadout, sockets, stats
    CharacterController.ts     # capsule vs BVH, gravity, ground snap
    PlayerStateMachine.ts      # Idle/Run/Jump/Fall/Glide/Gust
    ChassisBuilder.ts          # procedural body from primitives
    Sockets.ts
    ProcAnim.ts                # squash/stretch/lean
  elements/
    ElementRegistry.ts  ElementModule.ts  StatResolver.ts  Fusion.ts
    wind/
      WindModule.ts  WindVfx.ts
      abilities/GustAbility.ts  GlideAbility.ts
  abilities/
    Ability.ts                 # canUse / start / update / end / cooldown
  ui/
    Hud.ts  PauseMenu.ts  LevelComplete.ts  TitleScreen.ts
  levels/
    level01.json
```

### 8.6 Key interfaces

```ts
export type ElementId = 'wind' | 'fire' | 'water' | 'earth';
export type Tag = 'light' | 'heavy' | 'air' | 'burning' | 'wet' | 'earthen';

export interface PlayerStats {
  mass: number;
  moveSpeed: number;
  accelGround: number;
  accelAir: number;
  friction: number;
  turnSpeed: number;
  jumpHeight: number;
  gravity: number;
  fallGravityMult: number;
  lowJumpMult: number;
  maxFallSpeed: number;
  airControl: number;
}

export interface ElementModule {
  id: ElementId;
  displayName: string;              // "Wind Core"
  bodyTint: string;                 // hex
  tags: Tag[];
  statMods: Partial<PlayerStats>;   // multiplicative or absolute — pick ONE and document it
  attachments: AttachmentSpec[];
  abilities: AbilitySpec[];
  vfx: () => ElementVfx;
}

// Stat resolution: pure function. Unit-tested. Deterministic.
export function resolveStats(base: PlayerStats, loadout: ElementModule[]): PlayerStats;

export interface Ability {
  id: string;
  cooldown: number;
  canUse(s: PlayerRuntimeState): boolean;
  start(s: PlayerRuntimeState, w: World): void;
  update(dt: number, s: PlayerRuntimeState, w: World): void;
  end(s: PlayerRuntimeState): void;
}
```

**Contract:** `resolveStats` is pure and unit-tested. Elements never mutate the player directly.

---

## §9. Starting tuning values

Put ALL of these in `config/tuning.ts`. **Zero magic numbers anywhere else in the codebase.** If Claude Code writes a hardcoded `0.35` in gameplay code, that's a bug.

```ts
export const TUNING = {
  loop: { fixedDt: 1 / 60, maxSubsteps: 5 },

  camera: {
    fov: 45, yawDeg: 45, pitchDeg: 38, distance: 16,
    heightOffset: 1.2, followStiffness: 8, lookAheadFactor: 0.35,
  },

  player: {
    radius: 0.35,
    height: 1.30,
    coyoteTime: 0.10,
    jumpBuffer: 0.12,
    groundSnapDist: 0.25,
    maxSlopeDeg: 48,
    respawnFallY: -20,
    respawnFade: 0.18,
    squash: { land: [1.25, 0.72, 1.25], jump: [0.82, 1.22, 0.82], recover: 12 },
    baseStats: {
      mass: 1.0,
      moveSpeed: 6.5,
      accelGround: 60,
      accelAir: 25,
      friction: 12,
      turnSpeed: 14,
      jumpHeight: 2.1,      // metres — derive impulse from gravity
      gravity: 24,          // NOT 9.8. Platformers need snap.
      fallGravityMult: 1.6,
      lowJumpMult: 2.2,
      maxFallSpeed: 28,
      airControl: 0.65,
    },
  },

  elements: {
    MAX_ACTIVE: 1,          // ← flip to 2+ when you're ready to stack. Architecture already supports it.
    pickupTimeDilation: { scale: 0.25, duration: 0.30 },
    tintLerpTime: 0.35,
  },

  wind: {
    tint: '#A9B4BC',
    statMods: {
      mass: 0.6, jumpHeight: 2.6, fallGravityMult: 1.15,
      airControl: 0.85, moveSpeed: 7.2,
    },
    glide: { maxFallSpeed: 3.2, horizontalDrag: 0.92, airControl: 0.95, minAirTime: 0.15 },
    gust: {
      cooldown: 0.55, range: 5.5, coneDeg: 45, force: 18,
      selfImpulseAir: 5.0, selfImpulseGround: 0,
      windup: 0.08, duration: 0.18, hitStop: 0.04,
    },
    vfx: {
      streaks: 3, orbitRadius: 0.75, orbitSpeedBase: 2.2, orbitSpeedPerVel: 0.35,
      motes: 120, moteRadius: 1.1, moteDrift: 0.5,
      trailSpeedThreshold: 4.0,
    },
  },

  props: {
    windZone: { defaultForce: 9.5, period: 4.0, duration: 1.6, telegraph: 0.6 },
    updraft:  { velocity: 9.0, maxHeight: 12 },
    windmill: { torqueDecay: 0.85, activateAt: 6.0 },  // rad/s to fire signal
  },
} as const;
```

**Expect to change every number in `player.baseStats` and `wind.gust` at least ten times.** That is the job. That is what "game feel" means.

---

## §10. Milestones

**The rule that governs everything: the game must be playable at the end of every milestone.** If a milestone leaves it broken, the milestone was too big — split it.

| M | Deliverable | Definition of Done |
|---|---|---|
| **M0** | Scaffold: Vite + TS + Three, fixed-timestep loop, resize, grey box floor, isometric camera, debug overlay | `npm run dev` → grey plane at 38°, locked 60fps, F1 toggles stats |
| **M0.5** | Playwright screenshot harness (§8.4) | `npm run shot` writes PNGs. Claude Code can view them. |
| **M1** | Level pipeline: `level01.json` → LevelBuilder → meshes + BVH collider. F2 = collider wireframe. Click-to-copy-coords debug tool. | Edit the JSON → map changes on hot reload, no code touched |
| **M2** | **Character + controller.** Chassis, capsule vs BVH, camera-relative movement, jump + coyote + buffer + variable height, ground snap, slopes, squash/stretch, mass field. **Plus the two M2 requirements below this table (render interpolation; ground shadow + landing indicator).** | Someone else plays it and *doesn't comment on the movement*. That's the bar. Silence = success. |
| **M3** | **Element architecture.** Registry, `ElementModule`, loadout array (cap 1), `resolveStats` (unit tested), socket/attachment system, token pickup + HUD slot. **Wind is a stub: tint + stat mods only, no abilities.** | Touch the Core → turn grey, jump higher. `MAX_ACTIVE` exists in config. `resolveStats` has passing tests. |
| **M4** | **Wind abilities + all 9 props.** Gust, Glide. Props react to `PushEvent`, never to `'wind'`. Signal/gate wiring. Checkpoints. | Level 1's critical path is completable start to finish |
| **M5** | **VFX + game feel.** Streaks, motes, rotor, trail, the pickup moment, hit-stop, camera punch, land particles | The pickup moment makes you smile. Then, and only then, move on. |
| **M6** | **Shell.** Title, pause, level complete, save/load, level select, audio, settings | A stranger plays from a URL, start to finish, without you in the room |
| **M7** | **Polish + ship.** Bloom, fog, loading screen. **Deploy to itch.io.** | It's public. Real people can click it. |

**M2 REQUIREMENT — render interpolation** *(added at M0.5)*. Game exposes `alpha = accumulator / fixedDt`. Player renders at `lerp(prevTransform, currTransform, alpha)`. Without this a 60Hz sim rendered at any other rate judders, and I will mistake judder for bad movement tuning and waste a session.

**M2 REQUIREMENT — ground shadow + landing indicator** *(added at M0.5)*. A directional shadow for grounding, PLUS an always-visible blob raycast straight down from the player. In an angled 3D view height is unreadable without it, and I cannot judge whether jumping feels good if I cannot tell where I am going to land.

Then — and only then — **Fire**.

---

## §11. Failure modes

These will happen to you. Naming them now is the only defence.

1. **Tuning limbo.** You will spend three sessions on jump feel. That is *correct*. But cap it at two, ship it, and revisit at M5. Perfect feel with no game is nothing.

2. **The art trap.** Around M2 you will want it to *look* good before it *plays* good. Every hobby dev does this. M5 exists precisely so you don't. Grey boxes until M4 is done.

3. **The refactor trap.** Claude Code loves to restructure. Every unasked-for refactor risks a regression you cannot see, because you are not reading every line. **Guardrail it in CLAUDE.md. Commit before every session.**

4. **The scope trap.** "Just a quick enemy." "Let's try Fire and see." "What if there was a story." Each one is a project-ender before Level 1 ships. §1's anti-goals list exists for this.

5. **The abandonment trap.** The base rate for finishing a hobby game is well under 10%. Your countermeasures: the always-playable rule, the 5-minute level, and **shipping publicly at M7 even though it's tiny.** A finished 5-minute game is worth infinitely more than an abandoned 30-hour one — to you, and to whoever you eventually show it to.

6. **The taste gap.** Claude Code will write correct code that feels wrong. It cannot play the game. **Judging feel is your job and it is the only part of this project you cannot delegate.** After every milestone: play for 10 minutes, write 5 bullets on what feels bad, feed those in as the next session's input. That loop is the project.

---

## §12. Roadmap after v1

1. **Fire.** Same shape as Wind. If it takes more than a weekend, your element architecture failed — go fix §2.3 before continuing.
2. **Water. Earth.**
3. **Levels 2–4** — one per element, each teaching one verb, each ~5 minutes.
4. **Level 5+** — swap puzzles. Now the mass axis (§2.2) earns its keep.
5. **Then, and only then:** flip `MAX_ACTIVE` to 2 and start the fusion table (§2.5).
6. Speedrun timer + ghost. Trivial to add, enormous replay value, costs almost nothing.

---

*End of spec. If Claude Code proposes something not in this document, it must say so explicitly and explain why.*
