/**
 * The ONE slow-motion mechanism. Pickup dilation and Gust hit-stop both push
 * a named source here; the scale handed to sim consumers is the MIN of every
 * active source, so a freeze inside a dilation window still freezes.
 *
 * DETERMINISM CONTRACT: timers tick on RAW fixed-step time (Game calls
 * update() once per sim step, before reading `value`). The scale only ever
 * multiplies the dt handed to consumers — the accumulator and the fixed step
 * never see it, so harness runs stay reproducible through every window.
 */
export class TimeScale {
  private readonly sources = new Map<string, { scale: number; remaining: number }>();

  /** Start (or restart) a named source for `duration` seconds of raw time. */
  push(source: string, scale: number, duration: number): void {
    this.sources.set(source, { scale, remaining: duration });
  }

  /** Called once per fixed step with RAW (unscaled) dt. */
  update(rawDt: number): void {
    for (const [name, s] of this.sources) {
      s.remaining = Math.max(0, s.remaining - rawDt);
      if (s.remaining <= 0) this.sources.delete(name);
    }
  }

  /** MIN of every active source's scale; 1 when nothing is active. */
  get value(): number {
    let min = 1;
    for (const s of this.sources.values()) min = Math.min(min, s.scale);
    return min;
  }

  isActive(source: string): boolean {
    return this.sources.has(source);
  }

  /** End one named source early (the Level Complete freeze has no natural end). */
  release(source: string): void {
    this.sources.delete(source);
  }

  /** Replay: no source survives into the new run. */
  reset(): void {
    this.sources.clear();
  }
}
