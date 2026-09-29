import { describe, expect, it } from 'vitest';
import { actionGlyph, jumpGlyph, NO_INPUT } from './Input';

describe('action glyph (WO-004 D3) — derived from the bindings, never hard-coded', () => {
  it('keyboard: the ACTION key binding, as its keycap label', () => {
    expect(actionGlyph('keyboard')).toBe('E');
  });

  it('gamepad: the ACTION button, by its standard-mapping face label', () => {
    expect(actionGlyph('gamepad')).toBe('X');
  });
});

describe('jump glyph (WO-005 replay prompt) — derived from the bindings, never a word', () => {
  it('keyboard: the JUMP key binding as a symbol (Space is the visible-space sign, not the word)', () => {
    expect(jumpGlyph('keyboard')).toBe('␣');
    expect(jumpGlyph('keyboard')).not.toMatch(/[a-z]{2,}/i);
  });

  it('gamepad: the JUMP button, by its standard-mapping face label', () => {
    expect(jumpGlyph('gamepad')).toBe('A');
  });

  it('NO_INPUT is no input at all', () => {
    expect(NO_INPUT.move).toEqual({ x: 0, y: 0 });
    expect([NO_INPUT.jumpPressed, NO_INPUT.jumpHeld, NO_INPUT.actionPressed, NO_INPUT.actionHeld]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
