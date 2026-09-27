import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../../config/tuning';
import { EventBus, type PushEvent } from '../../core/Events';
import { buildElementRegistry } from '../../config/elements';
import { Materials } from '../../render/Materials';
import { Level } from '../Level';
import { LevelBuilder } from '../LevelBuilder';
import { parseProp } from '../PropSchema';
import { Signals } from '../Signals';
import type { PropContext, PropPlayerView } from './Prop';
import { Windmill } from './Windmill';

const DT = TUNING.loop.fixedDt;
const W = TUNING.props.windmill;

// ── shared harness ─────────────────────────────────────────────────────────
function playerView(feet = new THREE.Vector3()): PropPlayerView & { forces: THREE.Vector3[] } {
  const forces: THREE.Vector3[] = [];
  return {
    feet,
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
  const data = parseProp({ type: 'windmill', id: 'wm', pos: [0, 0, 0], emits: 'sig' }, 0);
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
    const weak = parseProp({ type: 'windmill', id: 'wm2', pos: [0, 0, 0], emits: 'sig', threshold: 1 }, 0);
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
