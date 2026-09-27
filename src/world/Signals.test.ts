import { describe, expect, it } from 'vitest';
import { Signals } from './Signals';

describe('Signals — latched signal/gate wiring', () => {
  it('a signal stays on once emitted (latched)', () => {
    const s = new Signals();
    expect(s.isOn('a')).toBe(false);
    s.emit('a');
    s.emit('a');
    expect(s.isOn('a')).toBe(true);
  });

  it('requireAll needs every id; any needs one', () => {
    const s = new Signals();
    s.emit('a');
    expect(s.satisfied(['a', 'b'], true)).toBe(false);
    expect(s.satisfied(['a', 'b'], false)).toBe(true);
    s.emit('b');
    expect(s.satisfied(['a', 'b'], true)).toBe(true);
  });

  it('an empty listen list is never satisfied (a gate with no wiring stays shut)', () => {
    const s = new Signals();
    expect(s.satisfied([], true)).toBe(false);
    expect(s.satisfied([], false)).toBe(false);
  });

  it('reset clears every latch (level reload)', () => {
    const s = new Signals();
    s.emit('a');
    s.reset();
    expect(s.isOn('a')).toBe(false);
  });
});
