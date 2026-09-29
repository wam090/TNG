// M4b unit 1 — the Still Yard (Beats 0–2). Layout rules from WO-004 D1, proven
// against level01.json and TUNING — change either and these re-run.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import pickupScript from '../../scripts/pickup.json';
import runEastScript from '../../scripts/run_east.json';
import yardChainScript from '../../scripts/yard_chain.json';
import { buildElementRegistry } from '../config/elements';
import { TUNING } from '../config/tuning';
import { EventBus } from '../core/Events';
import { NO_INPUT, type InputSnapshot } from '../core/Input';
import { LevelRun } from '../core/LevelRun';
import { DEG2RAD } from '../core/Math';
import { parseInputScript, ScriptedInput } from '../core/ScriptedInput';
import { TimeScale } from '../core/TimeScale';
import { Player } from '../player/Player';
import { CameraRig } from '../render/CameraRig';
import { Materials } from '../render/Materials';
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

describe('Still Yard — enclosure (no void, no sequence break)', () => {
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

  it('gate OPEN: the Goal becomes reachable, still with no void anywhere', () => {
    const f = flood(true);
    expect(f.hitVoid).toBe(false);
    expect(f.reachesGoal).toBe(true);
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
  /** Opaque-candidate level + prop objects (everything but the player's own). */
  occluders: () => THREE.Object3D[];
  events: string[];
}

const nullView: LevelCompleteView = { draw: () => undefined, hide: () => undefined };

function makeSim(): Sim {
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
  bus.on('levelComplete', () => {
    events.push('goal');
    const sh = level.shards;
    lc.complete({ shardsFound: sh.found, shardsTotal: sh.total, sky: level.skyColor });
  });
  const levelRun = new LevelRun(level, player, level01, [ts, lc, rig]);
  levelRun.start();
  rig.update(player.position, player.velocity, 0);
  const occluders = (): THREE.Object3D[] => scene.children.filter((o) => !playerObjects.has(o));
  return { scene, player, level, rig, ts, lc, occluders, events };
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

describe('Still Yard — Beat 2 end to end, and the camera never loses the player', () => {
  it('yard_chain: pickup → Gust → windmill signal → gate opens → Goal', () => {
    const sim = makeSim();
    run(sim, yardChainScript, () => undefined);
    expect(sim.events.filter((e) => e !== 'gust')).toEqual(['pickup', 'goal']);
    expect(sim.events).toContain('gust');
    expect(sim.level.signals.list()).toEqual(['sig_gate_yard']);
    expect(sim.player.safetyCapHits).toBe(0);
  });

  // Five heights up the capsule, feet to crown.
  const BODY = [0.15, 0.45, 0.75, 1.05, 1.28];
  const seenOf = (sim: Sim): number => {
    const f = sim.player.position;
    return BODY.filter((h) => visible(sim, new THREE.Vector3(f.x, f.y + h, f.z), 0.05)).length;
  };

  it('on the critical path (yard_chain) the camera never loses him: at most the feet are hidden, never more', () => {
    // Measured: feet-only occlusion for 6 steps dropping off the pillar's far side (the pillar
    // is between him and the camera) and 5 steps in the gateway. Everything else: all 5 visible.
    const sim = makeSim();
    let worst = BODY.length;
    let partial = 0;
    run(sim, yardChainScript, () => {
      const seen = seenOf(sim);
      worst = Math.min(worst, seen);
      if (seen < BODY.length) partial += 1;
    });
    expect(worst).toBeGreaterThanOrEqual(BODY.length - 1);
    expect(partial).toBeLessThanOrEqual(12);
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
    run(sim, yardChainScript, (i) => {
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
    run(sim, yardChainScript, () => undefined);
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
    run(played, yardChainScript, () => undefined);
    expect(played.player.elementCount).toBe(1);
    expect(played.level.signals.list()).toEqual(['sig_gate_yard']);
    while (!played.lc.accepting) stepOnce(played, NO_INPUT);
    stepOnce(played, JUMP_PRESS);
    expect(played.events.at(-1)).toBe('replay');

    const fresh = makeSim();
    stepOnce(fresh, NO_INPUT); // the replay step is the new run's first step
    expect(digest(played)).toEqual(digest(fresh));

    // Same future, step for step: the whole chain again, compared every 10 steps and at the end.
    const a: unknown[] = [];
    const b: unknown[] = [];
    run(played, yardChainScript, (i) => {
      if (i % 10 === 0) a.push(digest(played));
    });
    run(fresh, yardChainScript, (i) => {
      if (i % 10 === 0) b.push(digest(fresh));
    });
    expect(a).toEqual(b);
    expect(digest(played)).toEqual(digest(fresh));
    expect(played.lc.isShowing).toBe(true); // the second run reached the Goal too
  });
});
