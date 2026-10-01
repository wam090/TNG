// M4b unit 1 — the Still Yard (Beats 0–2). Layout rules from WO-004 D1, proven
// against level01.json and TUNING — change either and these re-run.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import pickupScript from '../../scripts/pickup.json';
import runEastScript from '../../scripts/run_east.json';
import fullRunScript from '../../scripts/full_run.json';
import ventCourtScript from '../../scripts/vent_court.json';
import yardChainScript from '../../scripts/yard_chain.json';
import { buildElementRegistry } from '../config/elements';
import { TUNING } from '../config/tuning';
import { EventBus } from '../core/Events';
import { NO_INPUT, type InputSnapshot } from '../core/Input';
import { LevelRun } from '../core/LevelRun';
import { DEG2RAD } from '../core/Math';
import { parseInputScript, ScriptedInput } from '../core/ScriptedInput';
import { TimeScale } from '../core/TimeScale';
import { inputToWorld, Player } from '../player/Player';
import { CameraRig } from '../render/CameraRig';
import { Materials } from '../render/Materials';
import { GlidePrompt } from '../ui/GlidePrompt';
import { LevelComplete, type LevelCompleteView } from '../ui/LevelComplete';
import { Level } from '../world/Level';
import { LevelBuilder } from '../world/LevelBuilder';
import { parseLevel } from '../world/LevelSchema';
import { createProp } from '../world/props/PropFactory';
import level01 from './level01.json';

const DT = TUNING.loop.fixedDt;
const data = parseLevel(level01);
const WIND = { ...TUNING.player.baseStats, ...TUNING.wind.statMods };
const MARGIN = 0.5; // clearance above the highest reachable feet height (capsule edge rounding + slack)
const noDebug = { registerToggle: (): void => undefined, isToggleOn: (): boolean => false };

// ── Beat 3, the Vent Court: what the tests below measure against (all from the JSON) ──
function beat3() {
  const updraft = data.props.find((p) => p.type === 'updraft');
  const debris = data.props.find((p) => p.type === 'debris');
  const goal = data.props.find((p) => p.type === 'goal');
  if (updraft?.type !== 'updraft' || debris?.type !== 'debris' || goal?.type !== 'goal') throw new Error('Beat 3 changed');
  // The ledge: the block the Goal stands on.
  const ledge = data.blocks.find(
    (b) =>
      Math.abs(b.pos[1] + b.size[1] / 2 - goal.pos[1]) < 1e-6 &&
      Math.abs(goal.pos[0] - b.pos[0]) <= b.size[0] / 2 &&
      Math.abs(goal.pos[2] - b.pos[2]) <= b.size[2] / 2,
  );
  if (!ledge) throw new Error('the Goal is not on a ledge');
  return { updraft, debris, goal, ledge, top: goal.pos[1], front: ledge.pos[2] + ledge.size[2] / 2 };
}
const B3 = beat3();
const VENT = { x: B3.updraft.pos[0], base: B3.updraft.pos[1], z: B3.updraft.pos[2], half: B3.updraft.size[2] / 2 };

// ── solid footprints (blocks + solid props) ────────────────────────────────
interface Solid {
  name: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

function blockSolids(): Solid[] {
  return data.blocks.map((b, i) => {
    const box = new THREE.Box3(
      new THREE.Vector3(-b.size[0] / 2, -b.size[1] / 2, -b.size[2] / 2),
      new THREE.Vector3(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2),
    );
    const m = new THREE.Matrix4().makeRotationY(b.rotY * DEG2RAD).setPosition(...b.pos);
    box.applyMatrix4(m);
    return { name: `blocks[${String(i)}] ${b.type}`, min: box.min, max: box.max };
  });
}

function propSolids(gateOpen: boolean): Solid[] {
  const scene = new THREE.Scene();
  const materials = new Materials();
  const out: Solid[] = [];
  for (const p of data.props) {
    if (gateOpen && p.type === 'gate') continue;
    const g = createProp(p, { scene, materials }).solid();
    if (!g) continue;
    g.computeBoundingBox();
    const bb = g.boundingBox ?? new THREE.Box3();
    out.push({ name: `${p.type} ${p.id}`, min: bb.min.clone(), max: bb.max.clone() });
  }
  return out;
}

const covers = (outer: Solid, inner: Solid): boolean =>
  outer.min.x <= inner.min.x + 1e-6 &&
  outer.max.x >= inner.max.x - 1e-6 &&
  outer.min.z <= inner.min.z + 1e-6 &&
  outer.max.z >= inner.max.z - 1e-6;

/** A top you can stand on: nothing overhangs its whole footprint within a capsule height. */
function standable(s: Solid, all: Solid[]): boolean {
  const top = s.max.y;
  return !all.some(
    (o) => o !== s && covers(o, s) && o.min.y >= top - 1e-6 && o.min.y < top + TUNING.player.height,
  );
}

/** Highest reachable FEET height: fixed point of "stand on anything you can reach, then jump". */
function highestReach(solids: Solid[]): { reach: number; from: string } {
  let reach: number = WIND.jumpHeight; // from the floor (top 0)
  let from = 'floor';
  for (;;) {
    let best: Solid | null = null;
    for (const s of solids) {
      if (s.max.y <= reach && standable(s, solids) && (best === null || s.max.y > best.max.y)) best = s;
    }
    const next = Math.max(WIND.jumpHeight, (best?.max.y ?? 0) + WIND.jumpHeight);
    if (next <= reach + 1e-9) return { reach, from };
    reach = next;
    from = best?.name ?? from;
  }
}

// ── flood fill over a grid: where can the body walk or jump? ────────────────
const CELL = 0.2;
function flood(gateOpen: boolean): { reached: Set<string>; hitVoid: boolean; reachesGoal: boolean; reach: number } {
  const solids = [...blockSolids(), ...propSolids(gateOpen)];
  const { reach } = highestReach([...blockSolids(), ...propSolids(false)]);
  const floorish = blockSolids();
  const at = (i: number, j: number): [number, number] => [i * CELL, j * CELL];
  const inside = (s: Solid, x: number, z: number): boolean => x >= s.min.x && x <= s.max.x && z >= s.min.z && z <= s.max.z;
  // A column is passable if SOME standing level the body can get to (the floor, or a
  // solid's top no higher than reach + margin) has a capsule height of free space above
  // it. So the lintel is walked under, and a closed gate capped by a lintel is solid.
  const blocked = (x: number, z: number): boolean => {
    const column = solids.filter((s) => inside(s, x, z) && s.max.y > 1e-6);
    const levels = [0, ...column.map((s) => s.max.y)].filter((l) => l <= reach + MARGIN);
    return !levels.some((l) => column.every((s) => s.max.y <= l + 1e-6 || s.min.y >= l + TUNING.player.height));
  };
  const supported = (x: number, z: number): boolean => floorish.some((s) => inside(s, x, z));
  const start: [number, number] = [Math.round(data.spawn[0] / CELL), Math.round(data.spawn[2] / CELL)];
  const goal = data.props.find((p) => p.type === 'goal');
  const reached = new Set<string>();
  const queue = [start];
  let hitVoid = false;
  let reachesGoal = false;
  while (queue.length > 0) {
    const cell = queue.pop();
    if (!cell) break;
    const key = `${String(cell[0])},${String(cell[1])}`;
    if (reached.has(key)) continue;
    const [x, z] = at(cell[0], cell[1]);
    if (blocked(x, z)) continue;
    reached.add(key);
    if (!supported(x, z)) {
      hitVoid = true;
      continue;
    }
    if (goal && Math.hypot(x - goal.pos[0], z - goal.pos[2]) < 0.5) reachesGoal = true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      queue.push([cell[0] + di, cell[1] + dj]);
    }
  }
  return { reached, hitVoid, reachesGoal, reach };
}
const cellOf = (x: number, z: number): string => `${String(Math.round(x / CELL))},${String(Math.round(z / CELL))}`;

describe('Still Yard + Vent Court — enclosure on foot (no void, no sequence break)', () => {
  it('the highest reachable point is the windmill tower top + a Wind jump, and nothing higher is standable', () => {
    const { reach, from } = highestReach([...blockSolids(), ...propSolids(false)]);
    expect(from).toContain('windmill');
    expect(reach).toBeCloseTo(2.4 + WIND.jumpHeight, 6);
  });

  it('gate CLOSED: no void is reachable anywhere, and the Goal is out of reach — the gate is the only way', () => {
    const f = flood(false);
    expect(f.reached.size).toBeGreaterThan(1000);
    expect(f.hitVoid).toBe(false);
    expect(f.reachesGoal).toBe(false);
  });

  it('gate OPEN: the Vent Court and its checkpoint are reachable on foot, with no void anywhere; the ledge is not', () => {
    const f = flood(true);
    const cp = data.props.find((p) => p.type === 'checkpoint');
    if (!cp) throw new Error('no checkpoint');
    expect(f.hitVoid).toBe(false);
    expect(f.reached.has(cellOf(cp.pos[0], cp.pos[2]))).toBe(true);
    expect(f.reached.has(cellOf(VENT.x, VENT.z + 2))).toBe(true); // the plinth's top
    expect(f.reachesGoal).toBe(false); // the Goal is on the ledge: updraft + glide only
  });

  it('every boundary top clears the highest reachable feet height by the margin', () => {
    const { reach } = highestReach([...blockSolids(), ...propSolids(false)]);
    const boundaries = blockSolids().filter((s) => s.max.y > reach);
    expect(boundaries.length).toBeGreaterThanOrEqual(9);
    for (const b of boundaries) expect(b.max.y).toBeGreaterThanOrEqual(reach + MARGIN);
  });

  it('the one ramp is gentle (≤ 18°, the proven climb angle)', () => {
    const ramps = data.blocks.filter((b) => b.type === 'ramp');
    expect(ramps).toHaveLength(1);
    const r = ramps[0];
    if (!r) throw new Error('no ramp');
    expect(Math.atan2(r.size[1], r.size[2]) / DEG2RAD).toBeLessThanOrEqual(18);
  });
});

// ── a tiny copy of Game's fixed step, driving the real Player + Level ───────
// The run is built exactly as main.ts builds it: LevelRun.start() loads it, and
// the Level Complete flow steps first on raw time and may withhold input.
interface Sim {
  scene: THREE.Scene;
  player: Player;
  level: Level;
  rig: CameraRig;
  ts: TimeScale;
  lc: LevelComplete;
  /** The glide prompt, wired as main.ts wires it; `keycap.visible` is what the screen shows. */
  glide: GlidePrompt;
  keycap: { visible: boolean };
  /** Opaque-candidate level + prop objects (everything but the player's own). */
  occluders: () => THREE.Object3D[];
  events: string[];
}

const nullView: LevelCompleteView = { draw: () => undefined, hide: () => undefined };

function makeSim(atCheckpoint = false, json: unknown = level01): Sim {
  const scene = new THREE.Scene();
  const materials = new Materials();
  const bus = new EventBus();
  const registry = buildElementRegistry();
  const level = new Level(scene, new LevelBuilder(materials), materials, noDebug, registry, bus);
  const beforePlayer = new Set(scene.children);
  const player = new Player(scene, () => level.collider);
  const playerObjects = new Set(scene.children.filter((o) => !beforePlayer.has(o)));
  const ts = new TimeScale();
  const rig = new CameraRig(16 / 9);
  const events: string[] = [];
  player.setAbilityHooks({
    pushCone: (e, r, c, d) => {
      events.push('gust');
      return level.pushCone(e, r, c, viewOf(player), d);
    },
    hitStop: (d) => {
      ts.push('hitStop', TUNING.elements.hitStopScale, d);
    },
  });
  bus.on('tokenPickup', ({ element }) => {
    player.addElement(registry.get(element));
    const D = TUNING.elements.pickupTimeDilation;
    ts.push('pickupDilation', D.scale, D.duration);
    events.push('pickup');
  });
  const lc: LevelComplete = new LevelComplete(ts, nullView, () => '␣', () => {
    levelRun.start();
    events.push('replay');
  });
  bus.on('checkpoint', () => events.push('checkpoint'));
  const keycap = { visible: false, dismissed: false };
  const glide = new GlidePrompt({
    show: () => {
      if (!keycap.dismissed) keycap.visible = true;
    },
    dismiss: () => {
      keycap.dismissed = true;
      keycap.visible = false;
    },
    reset: () => {
      keycap.dismissed = false;
      keycap.visible = false;
    },
  });
  bus.on('updraftLift', () => {
    glide.lifted();
  });
  bus.on('levelComplete', () => {
    events.push('goal');
    const sh = level.shards;
    lc.complete({ shardsFound: sh.found, shardsTotal: sh.total, sky: level.skyColor });
  });
  const levelRun = new LevelRun(level, player, json, [ts, lc, rig, glide]);
  levelRun.start();
  if (atCheckpoint) {
    player.addElement(registry.get('wind')); // F4
    const cp = level.checkpoints[0]; // F5
    if (cp) player.spawnAt(cp);
  }
  rig.update(player.position, player.velocity, 0);
  const occluders = (): THREE.Object3D[] => scene.children.filter((o) => !playerObjects.has(o));
  return { scene, player, level, rig, ts, lc, glide, keycap, occluders, events };
}

function viewOf(player: Player) {
  return {
    feet: player.position,
    velocity: player.velocity,
    applyForce: (f: THREE.Vector3): void => {
      player.applyForce(f);
    },
  };
}

/** One Game.update + stepManual's render-side sync, in Game's order. */
function stepOnce(sim: Sim, polled: InputSnapshot): void {
  const snap = sim.lc.step(DT, polled) ? NO_INPUT : polled;
  sim.ts.update(DT);
  const eff = DT * sim.ts.value;
  sim.player.update(eff, DT, snap);
  sim.level.update(eff, viewOf(sim.player));
  const airborne = !sim.player.grounded;
  sim.glide.step({
    rising: airborne && sim.player.velocity.y > 0,
    falling: airborne && sim.player.velocity.y < 0,
    gliding: sim.player.state === 'glide',
  });
  sim.player.syncVisual(1);
  sim.rig.update(sim.player.renderPosition, sim.player.velocity, DT);
}

function run(sim: Sim, script: unknown, onStep: (step: number) => void): void {
  const s = parseInputScript(script);
  const input = new ScriptedInput(s);
  for (let i = 0; i < s.steps; i += 1) {
    stepOnce(sim, input.poll());
    onStep(i);
  }
}

/** Is `point` visible from the camera — no opaque level/prop geometry in between? */
function visible(sim: Sim, point: THREE.Vector3, tolerance = 0.35): boolean {
  const cam = sim.rig.camera.position;
  const dir = point.clone().sub(cam);
  const dist = dir.length();
  const ray = new THREE.Raycaster(cam, dir.normalize(), 0, dist);
  for (const hit of ray.intersectObjects(sim.occluders(), true)) {
    let shown = true;
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) shown = false;
    const mat = (hit.object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const opaque = mat !== undefined && !Array.isArray(mat) && !mat.transparent;
    if (shown && opaque && hit.object instanceof THREE.Mesh && hit.distance < dist - tolerance) return false;
  }
  return true;
}

describe('Still Yard — Beats 0–1 (what spawn shows, the Core pillar)', () => {
  it('frame 0 from spawn shows the windmill, its shaft, the closed gate and the Core — in frame and unoccluded', () => {
    const sim = makeSim();
    sim.rig.camera.updateMatrixWorld();
    const wm = data.props.find((p) => p.type === 'windmill');
    const gate = data.props.find((p) => p.type === 'gate');
    const core = data.tokens[0];
    if (wm?.type !== 'windmill' || !wm.shaftTo || gate?.type !== 'gate' || !core) throw new Error('layout changed');
    const targets: [string, THREE.Vector3][] = [
      ['windmill hub', new THREE.Vector3(wm.pos[0], wm.pos[1] + 2.4, wm.pos[2])],
      ['shaft middle', new THREE.Vector3(...wm.pos).add(new THREE.Vector3(...wm.shaftTo)).multiplyScalar(0.5).setY(0.3)],
      ['shaft end at the gate', new THREE.Vector3(...wm.shaftTo)],
      ['gate', new THREE.Vector3(gate.pos[0], gate.pos[1] + 1.5, gate.pos[2])],
      ['Wind Core', new THREE.Vector3(...core.pos)],
    ];
    for (const [name, p] of targets) {
      const ndc = p.clone().project(sim.rig.camera);
      expect(Math.abs(ndc.x), `${name} x in frame`).toBeLessThan(0.95);
      expect(Math.abs(ndc.y), `${name} y in frame`).toBeLessThan(0.95);
      expect(visible(sim, p), `${name} unoccluded`).toBe(true);
    }
  });

  it('the Core pillar top sits well below a base jump, and a base body lands on it with ONE normal jump', () => {
    const index = data.blocks.findIndex((b) => b.mat === 'pillar');
    const pillar = blockSolids()[index];
    expect(pillar?.max.y).toBeLessThanOrEqual(TUNING.player.baseStats.jumpHeight - 0.6);
    const sim = makeSim();
    let landedOnTop = false;
    run(sim, pickupScript, () => {
      if (sim.player.grounded && Math.abs(sim.player.position.y - (pillar?.max.y ?? NaN)) < 0.02) landedOnTop = true;
    });
    expect(landedOnTop).toBe(true);
    expect(sim.events).toContain('pickup');
  });

  it('the windmill stands ≈5 m from the pillar (SPEC Beat 2)', () => {
    const wm = data.props.find((p) => p.type === 'windmill');
    const pillar = data.blocks.find((b) => b.mat === 'pillar');
    if (!wm || !pillar) throw new Error('layout changed');
    const d = Math.hypot(wm.pos[0] - pillar.pos[0], wm.pos[2] - pillar.pos[2]);
    expect(d).toBeGreaterThan(4);
    expect(d).toBeLessThan(6);
  });
});

describe('Beats 0–3 end to end, and the camera never loses the player', () => {
  it('yard_chain: pickup → Gust → windmill signal → gate opens → through it to the Beat 3 checkpoint', () => {
    const sim = makeSim();
    run(sim, yardChainScript, () => undefined);
    expect(sim.events.filter((e) => e !== 'gust')).toEqual(['pickup', 'checkpoint']);
    expect(sim.events).toContain('gust');
    expect(sim.level.signals.list()).toEqual(['sig_gate_yard']);
    expect(sim.player.safetyCapHits).toBe(0);
  });

  // Five heights up the capsule, feet to crown; each sampled at the centre line and at ±0.3 m
  // across the view (the capsule is 0.7 m wide). A height is seen if any of the three is:
  // a 0.3 m gate post in front of him hides the centre line but not the body (WO-005).
  const BODY = [0.15, 0.45, 0.75, 1.05, 1.28];
  const ACROSS = [0, -TUNING.player.radius * 0.85, TUNING.player.radius * 0.85];
  const seenOf = (sim: Sim): number => {
    const f = sim.player.position;
    const r = inputToWorld(1, 0); // screen right, in world space (the camera's fixed yaw)
    const right = new THREE.Vector3(r.x, 0, r.z);
    return BODY.filter((h) =>
      ACROSS.some((a) => visible(sim, new THREE.Vector3(f.x, f.y + h, f.z).addScaledVector(right, a), 0.05)),
    ).length;
  };

  it('full_run: all four beats, spawn → Core → windmill → gate → checkpoint → vent → ride → glide → ledge → Goal', () => {
    const sim = makeSim();
    run(sim, fullRunScript, () => undefined);
    expect(sim.events.filter((e) => e !== 'gust')).toEqual(['pickup', 'checkpoint', 'goal']);
    expect(sim.events.filter((e) => e === 'gust')).toHaveLength(2);
    expect(sim.level.signals.list()).toEqual(['sig_gate_yard', 'sig_vent_court']);
    expect(sim.lc.isShowing).toBe(true);
    expect(sim.player.position.y).toBeCloseTo(B3.top, 6); // he walked into the Goal on the ledge
    expect(sim.player.safetyCapHits).toBe(0);
  });

  it('vent_court (from the Beat 3 checkpoint, as F4 + F5): Gust → ride → glide → ledge → Goal', () => {
    const sim = makeSim(true);
    run(sim, ventCourtScript, () => undefined);
    expect(sim.events.filter((e) => e !== 'gust')).toEqual(['checkpoint', 'goal']);
    expect(sim.level.signals.list()).toEqual(['sig_vent_court']);
    expect(sim.lc.isShowing).toBe(true);
    expect(sim.player.safetyCapHits).toBe(0);
  });

  it('on the whole Beats 0–3 critical path (full_run, incl. the column ride and the glide) the camera never loses him', () => {
    // At most one of five body heights is ever hidden. Measured: ONE partial step on the whole
    // path; the ride is fully visible for 89 steps and the glide for 57.
    const sim = makeSim();
    let worst = BODY.length;
    let partial = 0;
    let riding = 0;
    let gliding = 0;
    run(sim, fullRunScript, () => {
      if (sim.lc.isShowing) return;
      const seen = seenOf(sim);
      worst = Math.min(worst, seen);
      if (seen < BODY.length) partial += 1;
      if (sim.player.position.y > B3.top + 1 && sim.player.state !== 'glide') riding += seen === BODY.length ? 1 : 0;
      if (sim.player.state === 'glide') gliding += seen === BODY.length ? 1 : 0;
    });
    expect(worst).toBeGreaterThanOrEqual(BODY.length - 1);
    expect(partial).toBeLessThanOrEqual(3);
    expect(riding).toBeGreaterThan(30); // fully visible through the ride…
    expect(gliding).toBeGreaterThan(30); // …and the glide
  });

  it('pressed against the camera-side rail (run_east) most of the body stays visible — the rail never hides him', () => {
    const sim = makeSim();
    let worst = BODY.length;
    run(sim, runEastScript, () => {
      worst = Math.min(worst, seenOf(sim));
    });
    expect(worst).toBeGreaterThanOrEqual(3);
  });
});

// ── WO-005 Stage A: the Level Complete card's clock and replay ──────────────
describe('Level Complete — the clock and the replay (WO-005 Stage A)', () => {
  const JUMP_PRESS: InputSnapshot = { ...NO_INPUT, jumpPressed: true, jumpHeld: true };

  it('the clock is raw fixed-step time from load to the Goal: pickup dilation and hit-stop do not shorten it', () => {
    const sim = makeSim();
    let goalStep = -1;
    let slowed = 0;
    run(sim, fullRunScript, (i) => {
      if (sim.ts.value < 1 && goalStep < 0) slowed += 1;
      if (goalStep < 0 && sim.events.includes('goal')) goalStep = i;
    });
    expect(slowed).toBeGreaterThan(0); // dilation and hit-stop both happened on the way
    expect(goalStep).toBeGreaterThan(0);
    expect(sim.lc.isShowing).toBe(true);
    expect(sim.lc.elapsed).toBeCloseTo((goalStep + 1) * DT, 9);
  });

  it('the card freezes the sim and withholds input: held stick + Jump move nothing', () => {
    const sim = makeSim();
    run(sim, fullRunScript, () => undefined);
    const at = sim.player.position.clone();
    const held: InputSnapshot = { ...NO_INPUT, move: { x: 1, y: -1 }, jumpHeld: true, actionHeld: true };
    for (let i = 0; i < 120; i += 1) stepOnce(sim, held);
    expect(sim.player.position.toArray()).toEqual(at.toArray());
    expect(sim.lc.isShowing).toBe(true); // held keys never replay
  });

  /** Everything a replay must put back: the whole scene graph, the body, the run's clocks, the camera. */
  function digest(sim: Sim): unknown {
    const objects: unknown[] = [];
    sim.scene.traverse((o) => {
      const mat = (o as Partial<THREE.Mesh>).material;
      const color = mat && !Array.isArray(mat) && 'color' in mat ? (mat.color as THREE.Color).getHexString() : '';
      objects.push([o.type, o.name, o.visible, ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray(), color]);
    });
    const p = sim.player;
    return {
      objects,
      player: [...p.position.toArray(), ...p.velocity.toArray(), p.grounded, p.state, p.elementCount, p.tintHex, p.stats],
      signals: sim.level.signals.list(),
      shards: sim.level.shards,
      runTime: sim.lc.elapsed,
      card: sim.lc.isShowing,
      timeScale: sim.ts.value,
      camera: [...sim.rig.camera.position.toArray(), sim.rig.camera.fov],
    };
  }

  it('Jump after the hold replays — and a replay leaves exactly what a fresh load leaves, with the same future', () => {
    const played = makeSim();
    run(played, fullRunScript, () => undefined);
    expect(played.player.elementCount).toBe(1);
    expect(played.level.signals.list()).toEqual(['sig_gate_yard', 'sig_vent_court']);
    while (!played.lc.accepting) stepOnce(played, NO_INPUT);
    stepOnce(played, JUMP_PRESS);
    expect(played.events.at(-1)).toBe('replay');

    const fresh = makeSim();
    stepOnce(fresh, NO_INPUT); // the replay step is the new run's first step
    expect(digest(played)).toEqual(digest(fresh));

    // Same future, step for step: the whole chain again, compared every 10 steps and at the end.
    const a: unknown[] = [];
    const b: unknown[] = [];
    run(played, fullRunScript, (i) => {
      if (i % 10 === 0) a.push(digest(played));
    });
    run(fresh, fullRunScript, (i) => {
      if (i % 10 === 0) b.push(digest(fresh));
    });
    expect(a).toEqual(b);
    expect(digest(played)).toEqual(digest(fresh));
    expect(played.lc.isShowing).toBe(true); // the second run reached the Goal too
  });
});


// ── WO-005 Stage B: Beat 3, the Vent Court ─────────────────────────────────
describe('Vent Court — Beat 3 (WO-005 Stage B)', () => {
  /** Stand on the open vent (vent_court's first 60 steps: Gust, hop on, step in), then fly by hand. */
  function fly(
    json: unknown,
    opts: { dir: { x: number; z: number }; moveAt: number; glide: boolean },
  ): { sim: Sim; apex: number; crossTop: number | null; landed: THREE.Vector3; left: boolean } {
    const sim = makeSim(true, json);
    const head = { ...ventCourtScript, steps: 60, segments: ventCourtScript.segments.filter((g) => g.from < 60) };
    run(sim, head, () => undefined);
    const stick = { x: 0, y: 0 };
    // inputToWorld is a rotation: invert it to find the stick for a world direction.
    const r = inputToWorld(1, 0);
    const d = inputToWorld(0, 1);
    const det = r.x * d.z - r.z * d.x;
    stick.x = (opts.dir.x * d.z - opts.dir.z * d.x) / det;
    stick.y = (r.x * opts.dir.z - r.z * opts.dir.x) / det;
    let moving = false;
    let prevJump = false;
    let apex = 0;
    let crossTop: number | null = null; // horizontal distance from the vent where the feet drop through the ledge top
    let left = false;
    let airborne = false;
    for (let i = 0; i < 1500; i += 1) {
      const py = sim.player.position.y; // a copy: the position vector is mutated in place by the step
      if (py > opts.moveAt) moving = true;
      const jumpHeld = opts.glide && moving && sim.player.velocity.y < 0;
      stepOnce(sim, {
        ...NO_INPUT,
        move: moving ? stick : { x: 0, y: 0 },
        jumpHeld,
        jumpPressed: jumpHeld && !prevJump,
        jumpReleased: !jumpHeld && prevJump,
      });
      prevJump = jumpHeld;
      const q = sim.player.position;
      apex = Math.max(apex, q.y);
      if (crossTop === null && py >= B3.top && q.y < B3.top) crossTop = Math.hypot(q.x - VENT.x, q.z - VENT.z);
      if (q.x < COURT.minX || q.x > COURT.maxX || q.z < COURT.minZ || q.z > COURT.maxZ || q.y < -0.01) left = true;
      if (q.y > VENT.base + 1) airborne = true;
      if (airborne && sim.player.grounded) break;
    }
    return { sim, apex, crossTop, landed: sim.player.position.clone(), left };
  }
  // The court's interior (inside its cliffs and rails), from the JSON's walls.
  // (the south side is the rail on the old far-wall line; the gate opening under it leads home)
  const COURT = { minX: -6, maxX: 10, minZ: -32, maxZ: -8.65 };
  const onLedge = (p: THREE.Vector3): boolean => Math.abs(p.y - B3.top) < 1e-6 && p.z <= B3.front;
  const NORTH = { x: 0, z: -1 };
  // The same court with the ledge and its cliff removed: how far a glide carries in open air.
  const openAir = {
    ...level01,
    goal: undefined,
    blocks: level01.blocks.filter(
      (b) => b.pos.join() !== B3.ledge.pos.join() && !((b.pos[2] ?? 0) < B3.front - 1 && (b.size[1] ?? 0) > B3.top),
    ),
  };

  it('the entrance: a checkpoint just past the gate, reached before the vent (SPEC §6.3)', () => {
    const cp = data.props.find((p) => p.type === 'checkpoint');
    const gate = data.props.find((p) => p.type === 'gate');
    if (!cp || !gate) throw new Error('layout changed');
    expect(Math.hypot(cp.pos[0] - gate.pos[0], cp.pos[2] - gate.pos[2])).toBeLessThan(4);
    expect(cp.pos[2]).toBeLessThan(gate.pos[2]); // on the court side
    const sim = makeSim();
    run(sim, fullRunScript, () => undefined);
    expect(sim.events).toEqual(['pickup', 'gust', 'checkpoint', 'gust', 'goal']);
  });

  it('the choked vent: debris sits on the updraft grate, the column listens to it, and stays shut until it goes', () => {
    expect(B3.debris.pos).toEqual(B3.updraft.pos);
    expect(B3.updraft.listensTo).toEqual([B3.debris.emits]);
    const sim = makeSim(true);
    sim.player.spawnAt(new THREE.Vector3(VENT.x + VENT.half - 0.4, VENT.base, VENT.z)); // on the grate, beside the pile
    for (let i = 0; i < 120; i += 1) stepOnce(sim, NO_INPUT);
    expect(sim.player.position.y).toBeCloseTo(VENT.base, 3); // no lift while choked
  });

  it('the Goal is on the ledge, at Beat 4\'s starting height (SPEC Beat 4: y = 6)', () => {
    expect(B3.top).toBe(6);
    expect(B3.goal.pos[1]).toBe(B3.top);
  });

  it('no sequence break: without the updraft the highest reachable point stays below the ledge', () => {
    const { reach } = highestReach([...blockSolids(), ...propSolids(false)]);
    expect(reach).toBeLessThan(B3.top - MARGIN);
  });

  it('no sequence break: riding the column WITHOUT gliding never makes the ledge (best of 16 strategies)', () => {
    let best = 0;
    for (const moveAt of [3, 6, 8, 9, 10, 11, 12, 13]) {
      for (const dir of [NORTH, { x: 0.3, z: -0.95 }]) {
        const f = fly(level01, { dir, moveAt, glide: false });
        expect(onLedge(f.landed)).toBe(false);
        best = Math.max(best, f.crossTop ?? 0);
      }
    }
    const needed = VENT.z - B3.front; // vent centre → ledge edge
    // Measured: the feet drop through the ledge height 9.58 m out, 1.92 m short (1.57 m counting the body's radius).
    expect(needed - best - TUNING.player.radius).toBeGreaterThan(1.25);
  });

  it('with the glide the ledge is made by a wide margin: glide range from the column ≥ 1.5 × the gap', () => {
    const made = fly(level01, { dir: NORTH, moveAt: 10, glide: true });
    expect(onLedge(made.landed)).toBe(true);
    const open = fly(openAir, { dir: NORTH, moveAt: 10, glide: true });
    const available = (open.crossTop ?? 0) - VENT.half; // from the column's edge
    const needed = VENT.z - B3.front - VENT.half; // column edge → ledge edge
    expect(needed).toBeCloseTo(10, 6);
    expect(available / needed).toBeGreaterThan(1.5); // measured: 18.5 m of glide for a 10 m gap (1.85×)
  });

  it('no void: a glide from the column top in ANY of 16 directions lands back in the court or on the ledge', () => {
    let apex = 0;
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * Math.PI * 2;
      const f = fly(level01, { dir: { x: Math.sin(a), z: -Math.cos(a) }, moveAt: 10, glide: true });
      expect(f.left, `direction ${String(k)}`).toBe(false);
      expect(f.landed.y).toBeGreaterThanOrEqual(0);
      apex = Math.max(apex, f.apex);
    }
    // Every court boundary is sealed above the apex (rails by their invisible collision).
    const seal = blockSolids().filter((b) => b.max.y > apex);
    expect(seal.length).toBeGreaterThanOrEqual(5);
  });

  it('the ledge is visible from the vent: its lip is in frame and unoccluded with him standing on the grate', () => {
    const sim = makeSim(true);
    run(sim, { ...ventCourtScript, steps: 60, segments: ventCourtScript.segments.filter((g) => g.from < 60) }, () => undefined);
    sim.player.spawnAt(new THREE.Vector3(VENT.x, VENT.base, VENT.z)); // centre of the (open) grate, standing
    for (let i = 0; i < 30; i += 1) sim.rig.update(sim.player.position, new THREE.Vector3(), DT);
    sim.rig.camera.updateMatrixWorld();
    const l = B3.ledge;
    let shown = 0;
    for (let x = l.pos[0] - l.size[0] / 2 + 0.5; x <= l.pos[0] + l.size[0] / 2 - 0.5; x += 0.5) {
      const p = new THREE.Vector3(x, B3.top, B3.front);
      const ndc = p.clone().project(sim.rig.camera);
      if (Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95 && visible(sim, p)) shown += 1;
    }
    expect(shown).toBeGreaterThanOrEqual(4); // ≥ 2 m of the landing edge
  });
});

// ── WO-006 Stage A: the glide prompt, in the real level ─────────────────────
describe('Glide prompt in the Vent Court (WO-006 Stage A)', () => {
  it('vent_court: hidden through the yard and the rise; shown from the first falling step after the lift until the glide', () => {
    const sim = makeSim(true);
    let carried = -1; // first step the column has carried him well above the plinth (the hop never gets there)
    let firstFall = -1;
    let firstGlide = -1;
    const shown: number[] = [];
    run(sim, ventCourtScript, (i) => {
      if (carried < 0 && sim.player.position.y > VENT.base + 3) carried = i;
      if (carried >= 0 && firstFall < 0 && !sim.player.grounded && sim.player.velocity.y < 0) firstFall = i;
      if (firstGlide < 0 && sim.player.state === 'glide') firstGlide = i;
      if (sim.keycap.visible) shown.push(i);
    });
    expect(carried).toBeGreaterThan(0);
    expect(firstFall).toBeGreaterThan(carried);
    expect(firstGlide).toBeGreaterThan(firstFall);
    expect(shown[0]).toBe(firstFall); // the very first falling step after the lift
    expect(shown.at(-1)).toBe(firstGlide - 1); // gone the step he glides
    expect(shown).toHaveLength(firstGlide - firstFall); // and visible every step between
    expect(sim.glide.isDone).toBe(true);
  });

  it('full_run: never shown in the yard (jumps and falls there do not arm it); a replay re-arms it for the next run', () => {
    const sim = makeSim();
    let shownBeforeCourt = false;
    let everShown = false;
    run(sim, fullRunScript, () => {
      if (sim.keycap.visible) {
        everShown = true;
        if (!sim.level.signals.list().includes('sig_vent_court')) shownBeforeCourt = true;
      }
    });
    expect(everShown).toBe(true);
    expect(shownBeforeCourt).toBe(false);
    expect(sim.glide.isDone).toBe(true);
    while (!sim.lc.accepting) stepOnce(sim, NO_INPUT);
    stepOnce(sim, { ...NO_INPUT, jumpPressed: true, jumpHeld: true });
    expect(sim.events.at(-1)).toBe('replay');
    expect(sim.glide.isDone).toBe(false);
    expect(sim.keycap.visible).toBe(false);
  });
});
