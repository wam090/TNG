import { TUNING } from '../config/tuning';
import { clamp } from '../core/Math';
import type { TimeScale } from '../core/TimeScale';

const DILATION_SOURCE = 'pickupDilation';

/**
 * The pickup moment, stub form: time dilation + FOV punch envelopes.
 * M5 replaces the spectacle; this timing skeleton is permanent.
 *
 * Dilation is pushed into the shared TimeScale (the same mechanism Gust's
 * hit-stop uses — they combine by MIN). The FOV envelope ticks on RAW
 * fixed-step time, handed in by Game once per sim step.
 */
export class PickupFx {
  private fovTimer = Infinity; // Infinity = idle

  constructor(private readonly timeScale: TimeScale) {}

  trigger(): void {
    const D = TUNING.elements.pickupTimeDilation;
    this.timeScale.push(DILATION_SOURCE, D.scale, D.duration);
    this.fovTimer = 0;
  }

  /** Called once per fixed step with RAW (unscaled) dt. */
  update(rawDt: number): void {
    this.fovTimer += rawDt;
  }

  /** FOV offset envelope: base → base+delta over inTime, back over outTime. */
  get fovOffset(): number {
    const P = TUNING.elements.fovPunch;
    if (this.fovTimer >= P.inTime + P.outTime) return 0;
    if (this.fovTimer < P.inTime) {
      return P.delta * clamp(this.fovTimer / P.inTime, 0, 1);
    }
    return P.delta * (1 - clamp((this.fovTimer - P.inTime) / P.outTime, 0, 1));
  }
}
