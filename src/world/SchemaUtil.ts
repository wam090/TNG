/**
 * Thrown on malformed level JSON. The message always names the offending
 * block and field — this JSON is hand-authored, so the error IS the UX.
 */
export class LevelParseError extends Error {
  override name = 'LevelParseError';
}

export type Vec3Tuple = [number, number, number];

export function fail(context: string, problem: string): never {
  throw new LevelParseError(`${context}: ${problem}`);
}

export function asRecord(raw: unknown, context: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(context, 'expected a JSON object');
  }
  return raw as Record<string, unknown>;
}

export function asString(v: unknown, context: string, field: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(context, `"${field}" must be a non-empty string`);
  return v;
}

export function asNumber(v: unknown, context: string, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(context, `"${field}" must be a finite number`);
  return v;
}

export function asVec3(v: unknown, context: string, field: string): Vec3Tuple {
  if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    const got = Array.isArray(v) ? `an array of ${v.length.toFixed(0)}` : typeof v;
    fail(context, `"${field}" must be an array of 3 numbers [x, y, z], got ${got}`);
  }
  return [v[0], v[1], v[2]] as Vec3Tuple;
}
