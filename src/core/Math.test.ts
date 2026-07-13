import { describe, expect, it } from 'vitest';
import { clamp, damp } from './Math';
import { Rng } from './Rng';

describe('damp', () => {
  it('is 0 at dt=0 and approaches 1 for large dt', () => {
    expect(damp(8, 0)).toBe(0);
    expect(damp(8, 100)).toBeCloseTo(1, 6);
  });

  it('composes: two steps of dt equal one step of 2·dt (frame-rate independence)', () => {
    const stiffness = 8;
    const dt = 1 / 60;
    const one = damp(stiffness, dt);
    const twoSmallSteps = 1 - (1 - one) * (1 - one);
    expect(twoSmallSteps).toBeCloseTo(damp(stiffness, 2 * dt), 10);
  });
});

describe('clamp', () => {
  it('clamps below, inside and above the range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('stays in [0, 1) and differs across seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const va = Array.from({ length: 100 }, () => a.next());
    const vb = Array.from({ length: 100 }, () => b.next());
    expect(va.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(va).not.toEqual(vb);
  });

  it('int(min, max) is max-exclusive and min-inclusive', () => {
    const rng = new Rng(42);
    const values = Array.from({ length: 200 }, () => rng.int(0, 3));
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(2);
  });
});
