/**
 * Deterministic seeded RNG (mulberry32). The only sanctioned randomness
 * source in gameplay code — Math.random() is lint-banned everywhere else
 * under src/ (CLAUDE.md rule 4).
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max) — max exclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max));
  }
}
