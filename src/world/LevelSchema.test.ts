import { describe, expect, it } from 'vitest';
import { parseLevel } from './LevelSchema';
import { LevelParseError } from './SchemaUtil';

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

  it('ignores unknown top-level keys (content ahead of its systems)', () => {
    expect(() => parseLevel(level({ futureThing: [{}], anotherOne: {} }))).not.toThrow();
  });

  it('validates props — a malformed prop names its index, id and field', () => {
    expect(() => parseLevel(level({ props: [{}] }))).toThrow(/props\[0\]: "id" must be a non-empty string/);
    expect(() => parseLevel(level({ props: [{ id: 'x', type: 'teleporter', pos: [0, 0, 0] }] }))).toThrow(
      /props\[0\] \("x"\): unknown type "teleporter"/,
    );
    expect(() => parseLevel(level({ props: [{ id: 'wm', type: 'windmill', pos: [0, 0] }] }))).toThrow(
      /props\[0\] \("wm", windmill\): "pos" must be an array of 3 numbers/,
    );
  });

  it('shards[] and goal{} at the top level (SPEC §7) become props', () => {
    const data = parseLevel(level({ shards: [{ id: 'sh_1', pos: [1, 2, 3] }], goal: { pos: [4, 0, 5] } }));
    expect(data.props).toEqual([
      { type: 'shard', id: 'sh_1', pos: [1, 2, 3] },
      { type: 'goal', id: 'goal', pos: [4, 0, 5], radius: 1.5 },
    ]);
  });

  it('prop validation names the problem: gate wiring, zone timing, zero direction', () => {
    const p = (prop: Record<string, unknown>): unknown => level({ props: [{ id: 'p', pos: [0, 0, 0], ...prop }] });
    expect(() => parseLevel(p({ type: 'gate' }))).toThrow(/"listensTo" must be an array of signal ids/);
    expect(() => parseLevel(p({ type: 'windZone', size: [1, 1, 1], dir: [0, 0, 0] }))).toThrow(/"dir" must not be \[0, 0, 0\]/);
    expect(() => parseLevel(p({ type: 'windZone', size: [1, 1, 1], dir: [1, 0, 0], period: 2, duration: 1.6 }))).toThrow(
      /must fit inside "period"/,
    );
    expect(() => parseLevel(p({ type: 'windZone', dir: [1, 0, 0] }))).toThrow(/"size" is required/);
    expect(() => parseLevel(p({ type: 'updraft', requireAll: 'yes' }))).toThrow(/"requireAll" must be true or false/);
  });

  it('updraft defaults: SPEC §7 column, provisional force, SPEC velocity as the ceiling', () => {
    const data = parseLevel(level({ props: [{ id: 'u', type: 'updraft', pos: [0, 0, 0] }] }));
    expect(data.props[0]).toMatchObject({ size: [3, 12, 3], force: 20, velocity: 9, listensTo: [], requireAll: true });
  });

  it('prop defaults come from tuning (SPEC §6.4 thresholds)', () => {
    const data = parseLevel(level({ props: [{ id: 'wm', type: 'windmill', pos: [1, 0, 2] }] }));
    expect(data.props[0]).toMatchObject({ type: 'windmill', rotY: 0, emits: null, threshold: 12 });
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
      /blocks\[1\].*unknown type "cylinder".*"box", "ramp" or "fence"/,
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
      /blocks\[0\].*unknown mat "marble".*\(expected stone \| pillar \| metal\)/,
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
