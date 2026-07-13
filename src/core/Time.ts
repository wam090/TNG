import { TUNING } from '../config/tuning';

const MS_PER_SEC = 1000;

/**
 * The ONLY file allowed to read the wall clock (enforced by eslint
 * no-restricted-properties). Game reads the frame delta once per render
 * frame at the loop boundary; simulation code only ever sees the fixed dt.
 */
export class Time {
  private last = performance.now();

  /** Real seconds since the previous call, clamped to TUNING.loop.maxFrameDelta. */
  frameDelta(): number {
    const now = performance.now();
    const dt = (now - this.last) / MS_PER_SEC;
    this.last = now;
    return Math.min(dt, TUNING.loop.maxFrameDelta);
  }
}
