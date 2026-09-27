import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AbilityContext, AbilityWorld } from '../../../abilities/Ability';
import { AbilityRunner } from '../../../abilities/AbilityRunner';
import { TUNING } from '../../../config/tuning';
import type { PushEvent } from '../../../core/Events';
import { GustAbility } from './GustAbility';

const DT = TUNING.loop.fixedDt;
const G = TUNING.wind.gust;

function ctx(over: Partial<AbilityContext> = {}): AbilityContext {
  return {
    grounded: false,
    verticalVelocity: 0,
    airTime: 1,
    feet: new THREE.Vector3(1, 2, 3),
    facing: { x: 0, z: 1 },
    moveDir: { x: 0, z: 0 },
    jumpPressed: false,
    jumpHeld: false,
    actionPressed: false,
    stats: { ...TUNING.player.baseStats, ...TUNING.wind.statMods },
    tags: ['light', 'air'],
    groundWithin: () => false,
    ...over,
  };
}

interface Recorder extends AbilityWorld {
  pushes: { e: PushEvent; range: number; coneDeg: number }[];
  impulses: THREE.Vector3[];
  hitStops: number[];
}

function recorder(hitsPerPush: number): Recorder {
  const r: Recorder = {
    pushes: [],
    impulses: [],
    hitStops: [],
    pushCone: (e, range, coneDeg) => {
      r.pushes.push({ e, range, coneDeg });
      return hitsPerPush;
    },
    applyImpulse: (j) => {
      r.impulses.push(j.clone());
    },
    hitStop: (d) => {
      r.hitStops.push(d);
    },
  };
  return r;
}

function runGust(steps: number, pressAt: ReadonlySet<number>, w: AbilityWorld, over: Partial<AbilityContext> = {}): AbilityRunner {
  const runner = new AbilityRunner();
  runner.setAbilities([{ id: 'gust', create: () => new GustAbility() }]);
  for (let i = 0; i < steps; i += 1) runner.update(DT, ctx({ actionPressed: pressAt.has(i), ...over }), w);
  return runner;
}

describe('Gust — lifecycle and cooldown', () => {
  it('fires exactly once, after the windup — never on the press step', () => {
    const w = recorder(1);
    const windupSteps = Math.ceil(G.windup / DT);
    runGust(windupSteps, new Set([0]), w);
    expect(w.pushes).toHaveLength(0);
    const w2 = recorder(1);
    runGust(windupSteps + 2, new Set([0]), w2);
    expect(w2.pushes).toHaveLength(1);
  });

  it('is active for windup + duration, then ends', () => {
    const runner = runGust(2, new Set([0]), recorder(0));
    expect(runner.isActive('gust')).toBe(true);
    const after = runGust(Math.ceil((G.windup + G.duration) / DT) + 3, new Set([0]), recorder(0));
    expect(after.isActive('gust')).toBe(false);
  });

  it('cooldown: a second press inside the cooldown is ignored; one after it fires', () => {
    const cd = Math.ceil(G.cooldown / DT);
    const w = recorder(0);
    runGust(cd + 30, new Set([0, cd - 3, cd + 2]), w);
    expect(w.pushes).toHaveLength(2);
  });
});

describe('Gust — what it does when it fires', () => {
  it('pushes with SPEC force, range and cone, from the body centre, carrying the tags', () => {
    const w = recorder(1);
    runGust(20, new Set([0]), w);
    const p = w.pushes[0];
    expect(p?.e.force).toBe(G.force);
    expect(p?.range).toBe(G.range);
    expect(p?.coneDeg).toBe(G.coneDeg);
    expect(p?.e.origin.y).toBeCloseTo(2 + TUNING.player.height / 2, 9);
    expect(p?.e.tags).toEqual(['light', 'air']);
  });

  it('aims along move input when there is some, else along facing', () => {
    const w1 = recorder(0);
    runGust(20, new Set([0]), w1, { moveDir: { x: 1, z: 0 } });
    expect(w1.pushes[0]?.e.dir.x).toBeCloseTo(1, 9);
    const w2 = recorder(0);
    runGust(20, new Set([0]), w2, { facing: { x: 0, z: -1 } });
    expect(w2.pushes[0]?.e.dir.z).toBeCloseTo(-1, 9);
  });

  it('in the air, recoils opposite the aim with selfImpulseAir (through the mass path)', () => {
    const w = recorder(0);
    runGust(20, new Set([0]), w, { moveDir: { x: 1, z: 0 } });
    expect(w.impulses).toHaveLength(1);
    expect(w.impulses[0]?.x).toBeCloseTo(-G.selfImpulseAir, 9);
  });

  it('on the ground, no recoil (selfImpulseGround = 0)', () => {
    const w = recorder(0);
    runGust(20, new Set([0]), w, { grounded: true, airTime: 0 });
    expect(w.impulses).toHaveLength(0);
  });

  it('hit-stops only when the cone actually hit something', () => {
    const miss = recorder(0);
    runGust(20, new Set([0]), miss);
    expect(miss.hitStops).toHaveLength(0);
    const hit = recorder(2);
    runGust(20, new Set([0]), hit);
    expect(hit.hitStops).toEqual([G.hitStop]);
  });
});
