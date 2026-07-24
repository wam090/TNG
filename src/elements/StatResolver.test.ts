import { describe, expect, it } from 'vitest';
import { TUNING } from '../config/tuning';
import type { PlayerStats } from '../player/PlayerStats';
import { ELEMENT_IDS, type ElementModule } from './ElementModule';
import { resolveStats } from './StatResolver';

const base = (): PlayerStats => ({ ...TUNING.player.baseStats });

const makeModule = (idIndex: number, statMods: Partial<PlayerStats>): ElementModule => ({
  id: ELEMENT_IDS[idIndex] ?? ELEMENT_IDS[0],
  displayName: 'Test Module',
  bodyTint: '#A9B4BC',
  tags: [],
  statMods,
  attachments: [],
  abilities: [],
  vfx: () => ({ update: () => undefined, dispose: () => undefined }),
});

describe('resolveStats', () => {
  it('empty loadout returns the base stats as a NEW object', () => {
    const b = base();
    const resolved = resolveStats(b, []);
    expect(resolved).toEqual(b);
    expect(resolved).not.toBe(b);
  });

  it('single element: overridden keys replace, untouched keys survive', () => {
    const resolved = resolveStats(base(), [makeModule(0, { mass: 0.6, jumpHeight: 2.6 })]);
    expect(resolved.mass).toBe(0.6);
    expect(resolved.jumpHeight).toBe(2.6);
    expect(resolved.gravity).toBe(TUNING.player.baseStats.gravity);
    expect(resolved.friction).toBe(TUNING.player.baseStats.friction);
  });

  it('overrides are ABSOLUTE, not multiplicative — the fallGravityMult proof', () => {
    // Wind's fallGravityMult 1.15 must REPLACE base 1.6 (slower fall). As a
    // multiplier it would be 1.84 — a FASTER fall, the opposite of Wind.
    const resolved = resolveStats(base(), [makeModule(0, { fallGravityMult: 1.15 })]);
    expect(resolved.fallGravityMult).toBe(1.15);
  });

  it('two elements stacked: applied in order, later override wins per key', () => {
    const a = makeModule(0, { mass: 0.6, moveSpeed: 7.2 });
    const b = makeModule(1, { mass: 2.0, jumpHeight: 1.8 });
    const resolved = resolveStats(base(), [a, b]);
    expect(resolved.mass).toBe(2.0); // b wins the conflict
    expect(resolved.moveSpeed).toBe(7.2); // a's non-conflicting key survives
    expect(resolved.jumpHeight).toBe(1.8);
  });

  it('is pure: inputs are never mutated and results are deterministic', () => {
    const b = base();
    const frozen = JSON.stringify(b);
    const mod = makeModule(0, { mass: 0.6 });
    const modFrozen = JSON.stringify(mod.statMods);
    const first = resolveStats(b, [mod]);
    const second = resolveStats(b, [mod]);
    expect(JSON.stringify(b)).toBe(frozen);
    expect(JSON.stringify(mod.statMods)).toBe(modFrozen);
    expect(first).toEqual(second);
  });
});
