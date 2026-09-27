import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../config/tuning';
import type { AbilitySpec } from '../elements/ElementModule';
import type { Ability, AbilityContext, AbilityWorld } from './Ability';
import { AbilityRunner } from './AbilityRunner';

const DT = TUNING.loop.fixedDt;

function ctx(overrides: Partial<AbilityContext> = {}): AbilityContext {
  return {
    grounded: true,
    verticalVelocity: 0,
    airTime: 0,
    feet: new THREE.Vector3(),
    facing: { x: 0, z: 1 },
    moveDir: { x: 0, z: 0 },
    jumpPressed: false,
    jumpHeld: false,
    actionPressed: false,
    stats: { ...TUNING.player.baseStats },
    tags: [],
    groundWithin: () => false,
    ...overrides,
  };
}

const world: AbilityWorld = {
  applyImpulse: () => undefined,
  pushCone: () => 0,
  hitStop: () => undefined,
};

/** A probe ability: triggers on actionPressed, runs `lifetime` seconds, logs its lifecycle. */
function probe(lifetime: number, cooldown: number, log: string[]): AbilitySpec {
  return {
    id: 'probe',
    create: (): Ability => {
      let t = 0;
      return {
        id: 'probe',
        cooldown,
        state: 'gust',
        canUse: (s) => s.actionPressed,
        start: () => {
          t = 0;
          log.push('start');
        },
        update: (dt) => {
          t += dt;
          return t < lifetime;
        },
        end: () => log.push('end'),
        statOverrides: () => ({ maxFallSpeed: 1 }),
      };
    },
  };
}

function run(runner: AbilityRunner, steps: number, pressAt: ReadonlySet<number>, dt = DT): void {
  for (let i = 0; i < steps; i += 1) runner.update(dt, ctx({ actionPressed: pressAt.has(i) }), world);
}

describe('AbilityRunner — element-blind lifecycle', () => {
  it('canUse → start → update… → end, exactly once each', () => {
    const log: string[] = [];
    const runner = new AbilityRunner();
    runner.setAbilities([probe(0.1, 0, log)]);
    run(runner, 30, new Set([0]));
    expect(log).toEqual(['start', 'end']);
    expect(runner.isActive('probe')).toBe(false);
  });

  it('reports its state and stat overrides only while active', () => {
    const runner = new AbilityRunner();
    runner.setAbilities([probe(0.5, 0, [])]);
    expect(runner.activeState).toBeNull();
    run(runner, 1, new Set([0]));
    expect(runner.activeState).toBe('gust');
    expect(runner.statOverrides(ctx())).toEqual({ maxFallSpeed: 1 });
    run(runner, 60, new Set());
    expect(runner.activeState).toBeNull();
    expect(runner.statOverrides(ctx())).toEqual({});
  });

  it('cooldown blocks a re-trigger until it has elapsed, then allows it', () => {
    const log: string[] = [];
    const cooldown = 0.5;
    const runner = new AbilityRunner();
    runner.setAbilities([probe(0.05, cooldown, log)]);
    const cdSteps = Math.ceil(cooldown / DT);
    run(runner, cdSteps + 5, new Set([0, 10, cdSteps - 5, cdSteps + 2]));
    expect(log.filter((e) => e === 'start')).toHaveLength(2); // step 0 and cdSteps+2 only
  });

  it('cooldown ticks on WORLD dt: a freeze (dt 0) pauses it', () => {
    const runner = new AbilityRunner();
    runner.setAbilities([probe(0.05, 0.5, [])]);
    run(runner, 1, new Set([0]));
    const before = runner.cooldownLeft('probe');
    run(runner, 30, new Set(), 0);
    expect(runner.cooldownLeft('probe')).toBe(before);
  });

  it('a loadout change ends active abilities before replacing them', () => {
    const log: string[] = [];
    const runner = new AbilityRunner();
    runner.setAbilities([probe(10, 0, log)]);
    run(runner, 1, new Set([0]));
    runner.setAbilities([]);
    expect(log).toEqual(['start', 'end']);
    expect(runner.activeState).toBeNull();
  });
});
