import { describe, expect, it } from 'vitest';
import { actionGlyph } from './Input';

describe('action glyph (WO-004 D3) — derived from the bindings, never hard-coded', () => {
  it('keyboard: the ACTION key binding, as its keycap label', () => {
    expect(actionGlyph('keyboard')).toBe('E');
  });

  it('gamepad: the ACTION button, by its standard-mapping face label', () => {
    expect(actionGlyph('gamepad')).toBe('X');
  });
});
