import { Materials, type MaterialName } from '../render/Materials';

/**
 * Thrown on malformed level JSON. The message always names the offending
 * block and field — this JSON is hand-authored, so the error IS the UX.
 */
export class LevelParseError extends Error {
  override name = 'LevelParseError';
}

export type Vec3Tuple = [number, number, number];

export interface LevelFog {
  color: string;
  near: number;
  far: number;
}

export interface LevelEnv {
  sky: string;
  fog: LevelFog | null;
  sunDir: Vec3Tuple;
  sunIntensity: number;
  ambient: number;
}

export interface LevelBlock {
  type: 'box' | 'ramp';
  pos: Vec3Tuple;
  size: Vec3Tuple;
  rotY: number; // degrees
  mat: MaterialName;
}

export interface LevelData {
  id: string;
  name: string;
  spawn: Vec3Tuple;
  env: LevelEnv;
  blocks: LevelBlock[];
}

// Defaults when "env" is omitted — matches SPEC §7's sample environment.
const DEFAULT_ENV: LevelEnv = {
  sky: '#DCE7EE',
  fog: null,
  sunDir: [-0.4, -1.0, -0.3],
  sunIntensity: 1.0,
  ambient: 0.55,
};

function fail(context: string, problem: string): never {
  throw new LevelParseError(`${context}: ${problem}`);
}

function asRecord(raw: unknown, context: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(context, 'expected a JSON object');
  }
  return raw as Record<string, unknown>;
}

function asString(v: unknown, context: string, field: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(context, `"${field}" must be a non-empty string`);
  return v;
}

function asNumber(v: unknown, context: string, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(context, `"${field}" must be a finite number`);
  return v;
}

function asVec3(v: unknown, context: string, field: string): Vec3Tuple {
  if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    const got = Array.isArray(v) ? `an array of ${v.length.toFixed(0)}` : typeof v;
    fail(context, `"${field}" must be an array of 3 numbers [x, y, z], got ${got}`);
  }
  return [v[0], v[1], v[2]] as Vec3Tuple;
}

function parseEnv(raw: unknown, context: string): LevelEnv {
  if (raw === undefined) return DEFAULT_ENV;
  const o = asRecord(raw, `${context}.env`);
  let fog: LevelFog | null = null;
  if (o.fog !== undefined && o.fog !== null) {
    const f = asRecord(o.fog, `${context}.env.fog`);
    fog = {
      color: asString(f.color, `${context}.env.fog`, 'color'),
      near: asNumber(f.near, `${context}.env.fog`, 'near'),
      far: asNumber(f.far, `${context}.env.fog`, 'far'),
    };
  }
  return {
    sky: o.sky === undefined ? DEFAULT_ENV.sky : asString(o.sky, `${context}.env`, 'sky'),
    fog,
    sunDir: o.sunDir === undefined ? DEFAULT_ENV.sunDir : asVec3(o.sunDir, `${context}.env`, 'sunDir'),
    sunIntensity:
      o.sunIntensity === undefined
        ? DEFAULT_ENV.sunIntensity
        : asNumber(o.sunIntensity, `${context}.env`, 'sunIntensity'),
    ambient: o.ambient === undefined ? DEFAULT_ENV.ambient : asNumber(o.ambient, `${context}.env`, 'ambient'),
  };
}

function parseBlock(raw: unknown, index: number): LevelBlock {
  const context = `blocks[${index.toFixed(0)}]`;
  const o = asRecord(raw, context);
  const type = asString(o.type, context, 'type');
  if (type !== 'box' && type !== 'ramp') {
    fail(context, `unknown type "${type}" (expected "box" or "ramp")`);
  }
  const mat = asString(o.mat, `${context} ("${type}")`, 'mat');
  if (!Materials.isName(mat)) {
    fail(`${context} ("${type}")`, `unknown mat "${mat}" (expected ${Materials.names.join(' | ')})`);
  }
  const size = asVec3(o.size, `${context} ("${type}")`, 'size');
  if (size.some((n) => n <= 0)) {
    fail(`${context} ("${type}")`, `"size" components must all be > 0, got [${size.join(', ')}]`);
  }
  return {
    type,
    pos: asVec3(o.pos, `${context} ("${type}")`, 'pos'),
    size,
    rotY: o.rotY === undefined ? 0 : asNumber(o.rotY, `${context} ("${type}")`, 'rotY'),
    mat,
  };
}

/**
 * Validate untrusted level JSON into LevelData. Unknown top-level keys
 * (tokens, props, shards, goal…) are deliberately ignored so M4 content can
 * live in the file before the systems that consume it exist.
 */
export function parseLevel(raw: unknown): LevelData {
  const o = asRecord(raw, 'level');
  const id = asString(o.id, 'level', 'id');
  const context = `level "${id}"`;
  if (!Array.isArray(o.blocks) || o.blocks.length === 0) {
    fail(context, '"blocks" must be a non-empty array');
  }
  return {
    id,
    name: o.name === undefined ? id : asString(o.name, context, 'name'),
    spawn: asVec3(o.spawn, context, 'spawn'),
    env: parseEnv(o.env, context),
    blocks: o.blocks.map((b: unknown, i: number) => parseBlock(b, i)),
  };
}
