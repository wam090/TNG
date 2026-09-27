import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../../config/tuning';
import { EventBus, type PushEvent } from '../../core/Events';
import { buildElementRegistry } from '../../config/elements';
import { Materials } from '../../render/Materials';
import { Level } from '../Level';
import { LevelBuilder } from '../LevelBuilder';
import { parseProp, type PropData } from '../PropSchema';
import { Signals } from '../Signals';
import { CharacterController, type MoveIntent } from '../../player/CharacterController';
import type { PlayerStats } from '../../player/PlayerStats';
import { Checkpoint } from './Checkpoint';
import { Debris } from './Debris';
import { Fan } from './Fan';
import { Gate } from './Gate';
import { Goal } from './Goal';
import type { PropContext, PropPlayerView } from './Prop';
import { Shard } from './Shard';
import { Updraft } from './Updraft';
import { Windmill } from './Windmill';
import { WindZone } from './WindZone';

const DT = TUNING.loop.fixedDt;
const W = TUNING.props.windmill;

/** Parse a props[] entry and narrow it to one prop type (fails loudly if the type differs). */
function parseAs<T extends PropData['type']>(type: T, raw: Record<string, unknown>): Extract<PropData, { type: T }> {
  const data = parseProp({ type, ...raw }, 0);
  if (data.type !== type) throw new Error(`expected ${type}`);
  return data as Extract<PropData, { type: T }>;
}

// ── shared harness ─────────────────────────────────────────────────────────
function playerView(feet = new THREE.Vector3()): PropPlayerView & { forces: THREE.Vector3[] } {
  const forces: THREE.Vector3[] = [];
  return {
    feet,
    velocity: new THREE.Vector3(),
    forces,
    applyForce: (f) => {
      forces.push(f.clone());
    },
  };
}

function propCtx(player = playerView()): PropContext & { events: string[] } {
  const events: string[] = [];
  return {
    player,
    signals: new Signals(),
    events,
    setCheckpoint: (id) => events.push(`checkpoint:${id}`),
    collectShard: (id) => events.push(`shard:${id}`),
    completeLevel: () => events.push('goal'),
  };
}

const push = (force: number): PushEvent => ({
  origin: new THREE.Vector3(),
  dir: new THREE.Vector3(0, 0, -1),
  force,
  tags: [],
});

function step(prop: { update(dt: number, c: PropContext): void }, c: PropContext, seconds: number, dt = DT): void {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i += 1) prop.update(dt, c);
}

const noDebug = { registerToggle: (): void => undefined, isToggleOn: (): boolean => false };

function makeLevel(props: unknown[]): Level {
  const materials = new Materials();
  const level = new Level(
    new THREE.Scene(),
    new LevelBuilder(materials),
    materials,
    noDebug,
    buildElementRegistry(),
    new EventBus(),
  );
  level.load({
    id: 'prop-test',
    spawn: [0, 1, 0],
    blocks: [{ type: 'box', pos: [0, -0.5, 0], size: [60, 1, 60], mat: 'stone' }],
    props,
  });
  return level;
}

// ── Windmill ───────────────────────────────────────────────────────────────
describe('Windmill (SPEC §6.4) — reacts to push FORCE, never to identity', () => {
  const data = parseAs('windmill', { id: 'wm', pos: [0, 0, 0], emits: 'sig' });
  const make = (): Windmill => new Windmill(data, new THREE.Scene(), new Materials());

  it('a push at or below threshold does nothing (force must EXCEED it)', () => {
    const wm = make();
    wm.onPush(push(W.threshold));
    expect(wm.spin).toBe(0);
  });

  it('a push above threshold adds force × spinPerForce of spin', () => {
    const wm = make();
    wm.onPush(push(TUNING.wind.gust.force));
    expect(wm.spin).toBeCloseTo(TUNING.wind.gust.force * W.spinPerForce, 9);
  });

  it('spin decays by torqueDecay per SECOND — the same at 60 Hz and 120 Hz', () => {
    const at = (dt: number): number => {
      const wm = make();
      wm.onPush(push(20));
      step(wm, propCtx(), 1, dt);
      return wm.spin;
    };
    expect(at(DT)).toBeCloseTo(20 * W.spinPerForce * W.torqueDecay, 6);
    expect(at(DT / 2)).toBeCloseTo(at(DT), 6);
  });

  it('emits its signal once, after a full turn at speed', () => {
    const wm = make();
    const c = propCtx();
    wm.onPush(push(TUNING.wind.gust.force));
    step(wm, c, 0.3);
    expect(c.signals.isOn('sig')).toBe(false); // not a full turn yet
    step(wm, c, 1.5);
    expect(c.signals.isOn('sig')).toBe(true);
    expect(wm.hasEmitted).toBe(true);
  });

  it('a push that only grazes activateAt decays before a full turn — no signal', () => {
    const wm = make();
    const c = propCtx();
    wm.onPush(push(W.threshold + 0.5));
    expect(wm.spin).toBeGreaterThanOrEqual(W.activateAt);
    step(wm, c, 10);
    expect(c.signals.isOn('sig')).toBe(false);
  });

  it('never emits if it never reaches activateAt (a low-threshold windmill, a weak push)', () => {
    const weak = parseAs('windmill', { id: 'wm2', pos: [0, 0, 0], emits: 'sig', threshold: 1 });
    const wm = new Windmill(weak, new THREE.Scene(), new Materials());
    const c = propCtx();
    wm.onPush(push(2));
    expect(wm.spin).toBeLessThan(W.activateAt);
    step(wm, c, 10);
    expect(c.signals.isOn('sig')).toBe(false);
  });
});

// ── Push delivery (the cone) ───────────────────────────────────────────────
describe('Level.pushCone — who gets pushed', () => {
  const G = TUNING.wind.gust;
  const origin = new THREE.Vector3(0, TUNING.player.height / 2, 0);
  const windmillAt = (z: number): unknown => ({ type: 'windmill', id: 'wm', pos: [0, 0, z], emits: 'sig' });
  const gust = (dir: THREE.Vector3): PushEvent => ({ origin: origin.clone(), dir, force: G.force, tags: [] });

  it('hits a windmill 5 m ahead (Beat 2 distance) when aimed at it', () => {
    const level = makeLevel([windmillAt(-5)]);
    expect(level.pushCone(gust(new THREE.Vector3(0, 0, -1)), G.range, G.coneDeg, playerView())).toBe(1);
  });

  it('misses when aimed away, or out of range', () => {
    expect(makeLevel([windmillAt(-5)]).pushCone(gust(new THREE.Vector3(1, 0, 0)), G.range, G.coneDeg, playerView())).toBe(0);
    expect(makeLevel([windmillAt(-8)]).pushCone(gust(new THREE.Vector3(0, 0, -1)), G.range, G.coneDeg, playerView())).toBe(0);
  });

  it('respects the cone half-angle (coneDeg / 2)', () => {
    const level = makeLevel([windmillAt(-5)]);
    const half = (G.coneDeg / 2) * (Math.PI / 180);
    const inside = new THREE.Vector3(Math.sin(half * 0.8), 0, -Math.cos(half * 0.8));
    const outside = new THREE.Vector3(Math.sin(half * 1.3), 0, -Math.cos(half * 1.3));
    expect(level.pushCone(gust(inside), G.range, G.coneDeg, playerView())).toBe(1);
    expect(level.pushCone(gust(outside), G.range, G.coneDeg, playerView())).toBe(0);
  });

  it('one Gust spins a Beat-2 windmill all the way to its signal (the whole chain)', () => {
    const level = makeLevel([windmillAt(-5)]);
    level.pushCone(gust(new THREE.Vector3(0, 0, -1)), G.range, G.coneDeg, playerView());
    const view = playerView(new THREE.Vector3(0, 0, 0));
    for (let i = 0; i < 120; i += 1) level.update(DT, view);
    expect(level.signals.isOn('sig')).toBe(true);
  });

  it("a windmill's tower is solid: it is merged into the collider", () => {
    const level = makeLevel([windmillAt(-5)]);
    const hit = level.collider?.groundProbe(new THREE.Vector3(0, 10, -5));
    expect(hit?.point.y).toBeGreaterThan(1); // lands on the tower top, not the floor
  });
});

// ── Gate ───────────────────────────────────────────────────────────────────
describe('Gate (SPEC §6.4) — signals only', () => {
  const make = (over: Record<string, unknown> = {}): Gate =>
    new Gate(parseAs('gate', { id: 'g', pos: [0, 0, 0], listensTo: ['a', 'b'], ...over }), new THREE.Scene(), new Materials());

  it('requireAll (default): stays shut until EVERY listened signal is on', () => {
    const gate = make();
    const c = propCtx();
    c.signals.emit('a');
    step(gate, c, 3);
    expect(gate.isOpen).toBe(false);
    c.signals.emit('b');
    step(gate, c, TUNING.props.gate.openTime + 0.1);
    expect(gate.isOpen).toBe(true);
  });

  it('requireAll: false opens on any one', () => {
    const gate = make({ requireAll: false });
    const c = propCtx();
    c.signals.emit('b');
    step(gate, c, TUNING.props.gate.openTime + 0.1);
    expect(gate.isOpen).toBe(true);
  });

  it('grinds open over openTime and is solid until fully open', () => {
    const gate = make();
    const c = propCtx();
    c.signals.emit('a');
    c.signals.emit('b');
    step(gate, c, TUNING.props.gate.openTime * 0.5);
    expect(gate.isOpen).toBe(false);
    expect(gate.solid()).not.toBeNull();
    step(gate, c, TUNING.props.gate.openTime * 0.6);
    expect(gate.solid()).toBeNull();
  });

  it('a closed gate BLOCKS the capsule; once open, the capsule walks through (collider rebuild)', () => {
    const level = makeLevel([
      { type: 'gate', id: 'g', pos: [0, 0, -3], listensTo: ['open'] },
    ]);
    const ctrl = new CharacterController(() => level.collider);
    ctrl.teleport(new THREE.Vector3(0, 0, 0));
    const view = playerView(ctrl.position);
    const walk: MoveIntent = { x: 0, z: -1, jumpPressed: false, jumpHeld: false };
    const s = { ...TUNING.player.baseStats };
    for (let i = 0; i < 120; i += 1) {
      ctrl.update(DT, walk, s);
      level.update(DT, view);
    }
    expect(ctrl.position.z).toBeGreaterThan(-3); // stopped in front of the slab
    level.signals.emit('open');
    for (let i = 0; i < 240; i += 1) {
      ctrl.update(DT, walk, s);
      level.update(DT, view);
    }
    expect(ctrl.position.z).toBeLessThan(-6); // walked through the open gateway
  });
});

// ── Debris ─────────────────────────────────────────────────────────────────
describe('Debris (SPEC §6.4) — push force > 8 destroys it', () => {
  const make = (): Debris => new Debris(parseAs('debris', { id: 'd', pos: [0, 0, 0], emits: 'vent' }), new THREE.Scene(), new Materials());

  it('a push at or below threshold does nothing', () => {
    const d = make();
    const c = propCtx();
    d.onPush(push(TUNING.props.debris.threshold), c);
    expect(d.isDestroyed).toBe(false);
    expect(d.solid()).not.toBeNull();
  });

  it('a stronger push destroys it: signal emitted, no longer solid or pushable', () => {
    const d = make();
    const c = propCtx();
    d.onPush(push(TUNING.wind.gust.force), c);
    expect(d.isDestroyed).toBe(true);
    expect(c.signals.isOn('vent')).toBe(true);
    expect(d.solid()).toBeNull();
    expect(d.pushTarget()).toBeNull();
  });
});

// ── Updraft — the DM's mass test ───────────────────────────────────────────
describe('Updraft (SPEC §6.4, DM ruling) — an upward FORCE: light bodies rise, base bodies do not', () => {
  const LIGHT = (): PlayerStats => ({ ...TUNING.player.baseStats, ...TUNING.wind.statMods });
  const BASE = (): PlayerStats => ({ ...TUNING.player.baseStats });

  /** A controller standing in (or dropped into) an always-on updraft, stepped like the game does. */
  function ride(stats: PlayerStats, start: [number, number, number], seconds: number, vy0 = 0) {
    const level = makeLevel([{ type: 'updraft', id: 'u', pos: [0, 0, 0] }]);
    const ctrl = new CharacterController(() => level.collider);
    ctrl.teleport(new THREE.Vector3(...start));
    ctrl.velocity.y = vy0;
    const view: PropPlayerView = {
      feet: ctrl.position,
      velocity: ctrl.velocity,
      applyForce: (f) => {
        ctrl.applyForce(f);
      },
    };
    const idle: MoveIntent = { x: 0, z: 0, jumpPressed: false, jumpHeld: false };
    let minY = Infinity;
    let maxY = -Infinity;
    let maxVy = -Infinity;
    for (let i = 0; i < Math.round(seconds / DT); i += 1) {
      ctrl.update(DT, idle, stats);
      level.update(DT, view);
      minY = Math.min(minY, ctrl.position.y);
      maxY = Math.max(maxY, ctrl.position.y);
      maxVy = Math.max(maxVy, ctrl.velocity.y);
    }
    return { ctrl, minY, maxY, maxVy };
  }

  it('the force sits inside the window where this is true at all', () => {
    const light = LIGHT();
    const base = BASE();
    expect(TUNING.props.updraft.force).toBeGreaterThan(light.mass * light.gravity * light.fallGravityMult);
    expect(TUNING.props.updraft.force).toBeLessThan(base.mass * base.gravity);
  });

  it('a BASE body standing in the column stays on the ground — it sinks, it does not rise', () => {
    const { ctrl, maxY } = ride(BASE(), [0, 0, 0], 3);
    expect(ctrl.grounded).toBe(true);
    expect(maxY).toBeLessThan(0.01);
  });

  it('a LIGHT body standing in the column lifts off and rises', () => {
    const { maxY } = ride(LIGHT(), [0, 0, 0], 3);
    expect(maxY).toBeGreaterThan(8);
  });

  it('a LIGHT body dropping in is caught before the ground; a BASE body falls through', () => {
    expect(ride(LIGHT(), [0, 10, 0], 2, -5).minY).toBeGreaterThan(3);
    expect(ride(BASE(), [0, 10, 0], 2, -5).minY).toBeLessThan(0.01);
  });

  it('the rise speed is capped near SPEC velocity (9 m/s), and the lift ends near the column top', () => {
    const { maxVy, maxY } = ride(LIGHT(), [0, 0, 0], 6);
    const U = TUNING.props.updraft;
    const accelStep = (U.force / LIGHT().mass) * DT;
    expect(maxVy).toBeLessThanOrEqual(U.velocity + accelStep);
    const overshoot = (U.velocity + accelStep) ** 2 / (2 * LIGHT().gravity);
    expect(maxY).toBeLessThan(U.maxHeight + overshoot);
  });

  it('is inert until its signal (a choked vent), then enabled for good', () => {
    const u = new Updraft(parseAs('updraft', { id: 'u', pos: [0, 0, 0], listensTo: ['vent'] }), new THREE.Scene(), new Materials());
    const c = propCtx(playerView(new THREE.Vector3(0, 0, 0)));
    step(u, c, 1);
    expect(c.player.velocity.y).toBe(0);
    expect((c.player as ReturnType<typeof playerView>).forces).toHaveLength(0);
    c.signals.emit('vent');
    step(u, c, DT);
    expect(u.isEnabled).toBe(true);
    expect((c.player as ReturnType<typeof playerView>).forces.length).toBeGreaterThan(0);
  });
});

// ── WindZone ───────────────────────────────────────────────────────────────
describe('WindZone (SPEC §6.4) — pulsed horizontal force, never identity', () => {
  const Z = TUNING.props.windZone;
  const make = (): WindZone =>
    new WindZone(parseAs('windZone', { id: 'z', pos: [0, 0, 0], size: [4, 4, 4], dir: [0, 0, 2] }), new THREE.Scene());

  it('each period: calm, then telegraph, then gust — gust is the LAST `duration` seconds', () => {
    const z = make();
    const c = propCtx(playerView(new THREE.Vector3(50, 0, 50))); // outside
    const phaseAt = (t: number): string => {
      const zone = make();
      step(zone, c, t);
      return zone.phase;
    };
    expect(z.phase).toBe('calm');
    expect(phaseAt(Z.period - Z.duration - Z.telegraph - 0.1)).toBe('calm');
    expect(phaseAt(Z.period - Z.duration - Z.telegraph / 2)).toBe('telegraph');
    expect(phaseAt(Z.period - Z.duration / 2)).toBe('gust');
    expect(phaseAt(Z.period + 0.1)).toBe('calm');
  });

  it('pushes only during the gust, only a body inside, with |force| along the normalised dir', () => {
    const z = make();
    const inside = playerView(new THREE.Vector3(0, 0, 0));
    const c = propCtx(inside);
    step(z, c, Z.period - Z.duration - 0.05);
    expect(inside.forces).toHaveLength(0);
    step(z, c, 0.2);
    expect(inside.forces.length).toBeGreaterThan(0);
    const f = inside.forces[0] ?? new THREE.Vector3();
    expect(f.z).toBeCloseTo(Z.defaultForce, 9);
    expect(f.x).toBe(0);

    const outside = playerView(new THREE.Vector3(10, 0, 0));
    const z2 = make();
    step(z2, propCtx(outside), Z.period);
    expect(outside.forces).toHaveLength(0);
  });
});

// ── Fan ────────────────────────────────────────────────────────────────────
describe('Fan (SPEC §6.4) — a push switches on a continuous current', () => {
  const make = (): Fan => new Fan(parseAs('fan', { id: 'f', pos: [0, 0, 0], rotY: 90 }), new THREE.Scene(), new Materials());

  it('a push at or below threshold does nothing; above it, the fan runs (latched)', () => {
    const fan = make();
    fan.onPush(push(TUNING.props.fan.threshold));
    expect(fan.isRunning).toBe(false);
    fan.onPush(push(TUNING.wind.gust.force));
    expect(fan.isRunning).toBe(true);
  });

  it('running, it pushes a body in front of it along its facing — continuously, not in pulses', () => {
    const fan = make();
    const front = playerView(new THREE.Vector3(5, 0, 0)); // rotY 90 → faces +X
    const c = propCtx(front);
    step(fan, c, 1);
    expect(front.forces).toHaveLength(0); // off
    fan.onPush(push(TUNING.wind.gust.force));
    step(fan, c, 2 * TUNING.props.windZone.period);
    expect(front.forces).toHaveLength(Math.round((2 * TUNING.props.windZone.period) / DT));
    expect(front.forces[0]?.x).toBeCloseTo(TUNING.props.fan.force, 9);
  });

  it('a body behind the fan is not pushed', () => {
    const fan = make();
    const behind = playerView(new THREE.Vector3(-5, 0, 0));
    fan.onPush(push(TUNING.wind.gust.force));
    step(fan, propCtx(behind), 1);
    expect(behind.forces).toHaveLength(0);
  });
});

// ── Checkpoint / Shard / Goal ──────────────────────────────────────────────
describe('Checkpoint, Shard, Goal (SPEC §6.4) — player overlap', () => {
  it('Checkpoint: overlap sets the respawn point once (latched)', () => {
    const cp = new Checkpoint(parseAs('checkpoint', { id: 'cp', pos: [2, 0, 0] }), new THREE.Scene(), new Materials());
    const feet = new THREE.Vector3(10, 0, 0);
    const c = propCtx(playerView(feet));
    step(cp, c, 0.5);
    expect(c.events).toEqual([]);
    feet.set(2.5, 0, 0);
    step(cp, c, 0.5);
    expect(c.events).toEqual(['checkpoint:cp']);
    expect(cp.respawn.toArray()).toEqual([2, 0, 0]);
  });

  it('Shard: overlap collects it once and despawns it', () => {
    const shard = new Shard({ type: 'shard', id: 'sh', pos: [0, 1.5, 0] }, new THREE.Scene(), new Materials());
    const c = propCtx(playerView(new THREE.Vector3(0, 0, 0)));
    step(shard, c, 0.5);
    expect(c.events).toEqual(['shard:sh']);
    expect(shard.isCollected).toBe(true);
  });

  it('Shard: a near miss does not collect', () => {
    const shard = new Shard({ type: 'shard', id: 'sh', pos: [0, 1.5, 0] }, new THREE.Scene(), new Materials());
    const c = propCtx(playerView(new THREE.Vector3(TUNING.props.shard.radius + 0.2, 0, 0)));
    step(shard, c, 0.5);
    expect(c.events).toEqual([]);
  });

  it('Goal: walking into the pillar completes the level once; standing beside it does not', () => {
    const goal = new Goal({ type: 'goal', id: 'goal', pos: [0, 0, 0], radius: 1.5 }, new THREE.Scene());
    const feet = new THREE.Vector3(2, 0, 0);
    const c = propCtx(playerView(feet));
    step(goal, c, 0.5);
    expect(c.events).toEqual([]);
    feet.set(1, 0, 0);
    step(goal, c, 0.5);
    expect(c.events).toEqual(['goal']);
  });

});
