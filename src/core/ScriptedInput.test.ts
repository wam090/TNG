import { describe, expect, it } from 'vitest';
import { parseInputScript, ScriptedInput } from './ScriptedInput';

const script = (segments: unknown[] = [], steps = 240): unknown => ({
  name: 'test',
  steps,
  segments,
});

describe('parseInputScript', () => {
  it('accepts a valid script', () => {
    const parsed = parseInputScript(script([{ from: 10, until: 20, hold: ['jump'] }]));
    expect(parsed.name).toBe('test');
    expect(parsed.steps).toBe(240);
    expect(parsed.segments).toHaveLength(1);
  });

  it('rejects non-objects, bad steps, bad segments and unknown buttons', () => {
    expect(() => parseInputScript(null)).toThrow('not an object');
    expect(() => parseInputScript({ name: 'x', steps: 0, segments: [] })).toThrow('steps');
    expect(() => parseInputScript({ name: 'x', steps: 10 })).toThrow('segments');
    expect(() => parseInputScript(script([{ from: 5, until: 5, hold: [] }]))).toThrow('until');
    expect(() => parseInputScript(script([{ from: 0, until: 1, hold: ['fly'] }]))).toThrow('hold');
  });
});

describe('ScriptedInput', () => {
  it('produces zero input for an empty (idle) script', () => {
    const input = new ScriptedInput(parseInputScript(script()));
    for (let i = 0; i < 240; i += 1) {
      const s = input.poll();
      expect(s.move).toEqual({ x: 0, y: 0 });
      expect(s.jumpHeld || s.jumpPressed || s.jumpReleased).toBe(false);
      expect(s.actionHeld || s.actionPressed || s.actionReleased).toBe(false);
    }
  });

  it('computes press/hold/release edges at segment boundaries', () => {
    const input = new ScriptedInput(
      parseInputScript(script([{ from: 10, until: 20, hold: ['jump'] }])),
    );
    const polls = Array.from({ length: 25 }, () => input.poll());
    expect(polls[9]).toMatchObject({ jumpPressed: false, jumpHeld: false });
    expect(polls[10]).toMatchObject({ jumpPressed: true, jumpHeld: true, jumpReleased: false });
    expect(polls[11]).toMatchObject({ jumpPressed: false, jumpHeld: true });
    expect(polls[19]).toMatchObject({ jumpHeld: true });
    expect(polls[20]).toMatchObject({ jumpHeld: false, jumpReleased: true });
    expect(polls[21]).toMatchObject({ jumpReleased: false });
  });

  it('normalises diagonal movement to length 1', () => {
    const input = new ScriptedInput(
      parseInputScript(script([{ from: 0, until: 1, hold: ['up', 'right'] }])),
    );
    const s = input.poll();
    expect(Math.hypot(s.move.x, s.move.y)).toBeCloseTo(1, 10);
    expect(s.move.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(s.move.y).toBeCloseTo(-Math.SQRT1_2, 10); // up = -y (down-screen positive)
  });

  it('is deterministic: two instances of the same script produce identical snapshots', () => {
    const spec = script([
      { from: 0, until: 30, hold: ['right'] },
      { from: 15, until: 40, hold: ['jump'] },
    ]);
    const a = new ScriptedInput(parseInputScript(spec));
    const b = new ScriptedInput(parseInputScript(spec));
    for (let i = 0; i < 50; i += 1) {
      expect(a.poll()).toEqual(b.poll());
    }
  });
});
