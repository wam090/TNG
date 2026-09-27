import { TUNING } from '../config/tuning';
import { asNumber, asRecord, asString, asVec3, fail, type Vec3Tuple } from './SchemaUtil';

/** Windmill (SPEC §6.4): spins on a strong enough push; emits a signal on a full turn at speed. */
export interface WindmillData {
  type: 'windmill';
  id: string;
  pos: Vec3Tuple; // base centre, on the ground
  rotY: number; // degrees; the rotor disc faces local +Z
  emits: string | null;
  threshold: number;
}

export type PropData = WindmillData;

function optString(v: unknown, context: string, field: string): string | null {
  return v === undefined ? null : asString(v, context, field);
}

function optNumber(v: unknown, context: string, field: string, fallback: number): number {
  return v === undefined ? fallback : asNumber(v, context, field);
}

function parseWindmill(o: Record<string, unknown>, id: string, ctx: string): WindmillData {
  return {
    type: 'windmill',
    id,
    pos: asVec3(o.pos, ctx, 'pos'),
    rotY: optNumber(o.rotY, ctx, 'rotY', 0),
    emits: optString(o.emits, ctx, 'emits'),
    threshold: optNumber(o.threshold, ctx, 'threshold', TUNING.props.windmill.threshold),
  };
}

const PARSERS: Record<PropData['type'], (o: Record<string, unknown>, id: string, ctx: string) => PropData> = {
  windmill: parseWindmill,
};

function isPropType(t: string): t is PropData['type'] {
  return Object.hasOwn(PARSERS, t);
}

/** Validate one props[] entry. Errors name the entry, its id and the field. */
export function parseProp(raw: unknown, index: number): PropData {
  const context = `props[${index.toFixed(0)}]`;
  const o = asRecord(raw, context);
  const id = asString(o.id, context, 'id');
  const type = asString(o.type, `${context} ("${id}")`, 'type');
  if (!isPropType(type)) {
    fail(`${context} ("${id}")`, `unknown type "${type}" (expected ${Object.keys(PARSERS).join(' | ')})`);
  }
  return PARSERS[type](o, id, `${context} ("${id}", ${type})`);
}
