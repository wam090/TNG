export const DEG2RAD = Math.PI / 180;

/**
 * Frame-rate-independent smoothing factor. Use as the alpha of any lerp that
 * runs every frame: `pos.lerp(target, damp(stiffness, dt))`. Never lerp with
 * a raw constant alpha — that is frame-rate-dependent (CLAUDE.md rule 3).
 */
export function damp(stiffness: number, dt: number): number {
  return 1 - Math.exp(-stiffness * dt);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const TAU = Math.PI * 2;

/** Lerp between angles (radians) along the shortest arc. */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  return a + diff * t;
}
