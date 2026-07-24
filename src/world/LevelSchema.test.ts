import { describe, expect, it } from 'vitest';
import { LevelParseError, parseLevel } from './LevelSchema';

const box = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: 'box',
  pos: [0, 0, 0],
  size: [1, 1, 1],
  mat: 'stone',
  ...over,
});

const level = (over: Record<string, unknown> = {}): unknown => ({
  id: 'test01',
  spawn: [0, 2, 0],
  blocks: [box()],
  ...over,
});

describe('parseLevel', () => {
  it('parses a minimal level and fills defaults', () => {
    const data = parseLevel(level());
    expect(data.id).toBe('test01');
    expect(data.name).toBe('test01');
    expect(data.blocks[0]).toMatchObject({ type: 'box', rotY: 0, mat: 'stone' });
    expect(data.env.sky).toBe('#DCE7EE');
    expect(data.env.fog).toBeNull();
    expect(data.env.sunIntensity).toBe(1.0);
  });

  it('ignores unknown top-level keys (future props/shards/goal)', () => {
    expect(() => parseLevel(level({ props: [{}], shards: [{}], goal: {} }))).not.toThrow();
  });

  it('parses tokens and defaults to none', () => {
    expect(parseLevel(level()).tokens).toEqual([]);
    const data = parseLevel(
      level({ tokens: [{ id: 'core_1', element: 'wind', pos: [1, 2, 3] }] }),
    );
    expect(data.tokens).toEqual([{ id: 'core_1', element: 'wind', pos: [1, 2, 3] }]);
  });

  it('names the token and lists valid ids on a bad element', () => {
    expect(() =>
      parseLevel(level({ tokens: [{ id: 'core_1', element: 'plasma', pos: [0, 0, 0] }] })),
    ).toThrow(/tokens\[0\].*unknown element "plasma".*wind \| fire \| water \| earth/);
    expect(() => parseLevel(level({ tokens: [{ id: 'core_1', element: 'wind' }] }))).toThrow(
      /tokens\[0\].*"pos" must be an array of 3 numbers/,
    );
  });

  it('names the block and the problem on a bad type', () => {
    expect(() => parseLevel(level({ blocks: [box(), { ...box(), type: 'cylinder' }] }))).toThrow(
      /blocks\[1\].*unknown type "cylinder".*"box" or "ramp"/,
    );
  });

  it('names the block on missing size', () => {
    const bad = box();
    delete bad.size;
    expect(() => parseLevel(level({ blocks: [bad] }))).toThrow(
      /blocks\[0\].*"size" must be an array of 3 numbers/,
    );
  });

  it('names the block on a wrong-length array', () => {
    expect(() => parseLevel(level({ blocks: [box({ size: [4, 2] })] }))).toThrow(
      /blocks\[0\].*"size".*got an array of 2/,
    );
  });

  it('rejects non-positive size components', () => {
    expect(() => parseLevel(level({ blocks: [box({ size: [4, 0, 2] })] }))).toThrow(
      /blocks\[0\].*must all be > 0/,
    );
  });

  it('lists valid material names on a bad mat', () => {
    expect(() => parseLevel(level({ blocks: [box({ mat: 'marble' })] }))).toThrow(
      /blocks\[0\].*unknown mat "marble".*stone \| pillar \| metal \| accent/,
    );
  });

  it('requires spawn and a non-empty blocks array', () => {
    expect(() => parseLevel({ id: 'x', blocks: [box()] })).toThrow(/"spawn" must be an array of 3 numbers/);
    expect(() => parseLevel({ id: 'x', spawn: [0, 0, 0], blocks: [] })).toThrow(/non-empty array/);
  });

  it('throws LevelParseError, not a generic Error', () => {
    expect(() => parseLevel(null)).toThrow(LevelParseError);
    expect(() => parseLevel(level({ blocks: [box({ rotY: 'north' })] }))).toThrow(LevelParseError);
  });
});
