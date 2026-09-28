import { TUNING } from '../config/tuning';
import { asNumber, asRecord, asString, asVec3, fail, type Vec3Tuple } from './SchemaUtil';

// SPEC §6.4 — the nine props, as validated data. `pos` is BOTTOM-centre (ground
// contact) for everything that stands or spans a volume; a shard's pos is its
// floating centre. Omitted numbers fall back to TUNING, never to literals here.

export interface WindmillData {
  type: 'windmill';
  id: string;
  pos: Vec3Tuple;
  rotY: number;
  emits: string | null;
  threshold: number;
  /** Optional VISUAL drive shaft from the windmill's base to this point (e.g. at a gate); turns with the rotor. */
  shaftTo: Vec3Tuple | null;
}
export interface GateData { type: 'gate'; id: string; pos: Vec3Tuple; rotY: number; size: Vec3Tuple; listensTo: string[]; requireAll: boolean }
export interface DebrisData { type: 'debris'; id: string; pos: Vec3Tuple; emits: string | null; threshold: number }
export interface UpdraftData { type: 'updraft'; id: string; pos: Vec3Tuple; size: Vec3Tuple; listensTo: string[]; requireAll: boolean; force: number; velocity: number }
export interface FanData { type: 'fan'; id: string; pos: Vec3Tuple; rotY: number; threshold: number; force: number; reach: number }
export interface WindZoneData {
  type: 'windZone';
  id: string;
  pos: Vec3Tuple;
  size: Vec3Tuple;
  rotY: number;
  dir: Vec3Tuple;
  force: number;
  period: number;
  duration: number;
  telegraph: number;
}
export interface CheckpointData { type: 'checkpoint'; id: string; pos: Vec3Tuple; radius: number }
export interface ShardData { type: 'shard'; id: string; pos: Vec3Tuple }
export interface GoalData { type: 'goal'; id: string; pos: Vec3Tuple; radius: number }

export type PropData =
  | WindmillData
  | GateData
  | DebrisData
  | UpdraftData
  | FanData
  | WindZoneData
  | CheckpointData
  | ShardData
  | GoalData;

type Raw = Record<string, unknown>;

const optString = (v: unknown, ctx: string, f: string): string | null => (v === undefined ? null : asString(v, ctx, f));
const optNumber = (v: unknown, ctx: string, f: string, fallback: number): number =>
  v === undefined ? fallback : asNumber(v, ctx, f);

function positive(v: number, ctx: string, f: string): number {
  if (v <= 0) fail(ctx, `"${f}" must be > 0, got ${String(v)}`);
  return v;
}

/** `fallback: null` makes "size" required. */
function optSize(v: unknown, ctx: string, fallback: Vec3Tuple | null): Vec3Tuple {
  if (v === undefined && fallback === null) fail(ctx, '"size" is required: [width, height, depth]');
  const size = v === undefined && fallback ? fallback : asVec3(v, ctx, 'size');
  if (size.some((n) => n <= 0)) fail(ctx, `"size" components must all be > 0, got [${size.join(', ')}]`);
  return [size[0], size[1], size[2]];
}

function listensTo(o: Raw, ctx: string, required: boolean): string[] {
  if (o.listensTo === undefined) {
    if (required) fail(ctx, '"listensTo" must be an array of signal ids');
    return [];
  }
  if (!Array.isArray(o.listensTo) || o.listensTo.length === 0) {
    fail(ctx, '"listensTo" must be a non-empty array of signal ids');
  }
  return o.listensTo.map((s: unknown, i: number) => asString(s, ctx, `listensTo[${i.toFixed(0)}]`));
}

const requireAll = (o: Raw, ctx: string): boolean => {
  if (o.requireAll === undefined) return true;
  if (typeof o.requireAll !== 'boolean') fail(ctx, '"requireAll" must be true or false');
  return o.requireAll;
};

const PARSERS = {
  windmill: (o: Raw, id: string, c: string): WindmillData => ({
    type: 'windmill',
    id,
    pos: asVec3(o.pos, c, 'pos'),
    rotY: optNumber(o.rotY, c, 'rotY', 0),
    emits: optString(o.emits, c, 'emits'),
    threshold: optNumber(o.threshold, c, 'threshold', TUNING.props.windmill.threshold),
    shaftTo: o.shaftTo === undefined ? null : asVec3(o.shaftTo, c, 'shaftTo'),
  }),
  gate: (o: Raw, id: string, c: string): GateData => ({
    type: 'gate',
    id,
    pos: asVec3(o.pos, c, 'pos'),
    rotY: optNumber(o.rotY, c, 'rotY', 0),
    size: optSize(o.size, c, [...TUNING.props.gate.size]),
    listensTo: listensTo(o, c, true),
    requireAll: requireAll(o, c),
  }),
  debris: (o: Raw, id: string, c: string): DebrisData => ({
    type: 'debris',
    id,
    pos: asVec3(o.pos, c, 'pos'),
    emits: optString(o.emits, c, 'emits'),
    threshold: optNumber(o.threshold, c, 'threshold', TUNING.props.debris.threshold),
  }),
  updraft: (o: Raw, id: string, c: string): UpdraftData => {
    const U = TUNING.props.updraft;
    return {
      type: 'updraft',
      id,
      pos: asVec3(o.pos, c, 'pos'),
      size: optSize(o.size, c, [U.width, U.maxHeight, U.width]),
      listensTo: listensTo(o, c, false),
      requireAll: requireAll(o, c),
      force: positive(optNumber(o.force, c, 'force', U.force), c, 'force'),
      velocity: positive(optNumber(o.velocity, c, 'velocity', U.velocity), c, 'velocity'),
    };
  },
  fan: (o: Raw, id: string, c: string): FanData => {
    const F = TUNING.props.fan;
    return {
      type: 'fan',
      id,
      pos: asVec3(o.pos, c, 'pos'),
      rotY: optNumber(o.rotY, c, 'rotY', 0),
      threshold: optNumber(o.threshold, c, 'threshold', F.threshold),
      force: positive(optNumber(o.force, c, 'force', F.force), c, 'force'),
      reach: positive(optNumber(o.reach, c, 'reach', F.reach), c, 'reach'),
    };
  },
  windZone: (o: Raw, id: string, c: string): WindZoneData => {
    const Z = TUNING.props.windZone;
    const dir = asVec3(o.dir, c, 'dir');
    if (Math.hypot(...dir) === 0) fail(c, '"dir" must not be [0, 0, 0]');
    const period = positive(optNumber(o.period, c, 'period', Z.period), c, 'period');
    const duration = positive(optNumber(o.duration, c, 'duration', Z.duration), c, 'duration');
    const telegraph = optNumber(o.telegraph, c, 'telegraph', Z.telegraph);
    if (telegraph < 0 || duration + telegraph > period) {
      fail(c, `"duration" + "telegraph" must fit inside "period" (${String(duration)} + ${String(telegraph)} > ${String(period)})`);
    }
    return {
      type: 'windZone',
      id,
      pos: asVec3(o.pos, c, 'pos'),
      size: optSize(o.size, c, null),
      rotY: optNumber(o.rotY, c, 'rotY', 0),
      dir,
      force: positive(optNumber(o.force, c, 'force', Z.defaultForce), c, 'force'),
      period,
      duration,
      telegraph,
    };
  },
  checkpoint: (o: Raw, id: string, c: string): CheckpointData => ({
    type: 'checkpoint',
    id,
    pos: asVec3(o.pos, c, 'pos'),
    radius: positive(optNumber(o.radius, c, 'radius', TUNING.props.checkpoint.radius), c, 'radius'),
  }),
};

type ListedType = keyof typeof PARSERS;
const isListedType = (t: string): t is ListedType => Object.hasOwn(PARSERS, t);

/** Validate one props[] entry. Errors name the entry, its id and the field. */
export function parseProp(raw: unknown, index: number): PropData {
  const context = `props[${index.toFixed(0)}]`;
  const o = asRecord(raw, context);
  const id = asString(o.id, context, 'id');
  const type = asString(o.type, `${context} ("${id}")`, 'type');
  if (!isListedType(type)) {
    fail(`${context} ("${id}")`, `unknown type "${type}" (expected ${Object.keys(PARSERS).join(' | ')})`);
  }
  return PARSERS[type](o, id, `${context} ("${id}", ${type})`);
}

/** SPEC §7 top-level `shards: [{ id, pos }]`. */
export function parseShard(raw: unknown, index: number): ShardData {
  const context = `shards[${index.toFixed(0)}]`;
  const o = asRecord(raw, context);
  const id = asString(o.id, context, 'id');
  return { type: 'shard', id, pos: asVec3(o.pos, `${context} ("${id}")`, 'pos') };
}

/** SPEC §7 top-level `goal: { pos, radius }`. */
export function parseGoal(raw: unknown): GoalData {
  const o = asRecord(raw, 'goal');
  return {
    type: 'goal',
    id: 'goal',
    pos: asVec3(o.pos, 'goal', 'pos'),
    radius: positive(optNumber(o.radius, 'goal', 'radius', TUNING.props.goal.radius), 'goal', 'radius'),
  };
}
