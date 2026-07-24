import { TUNING } from '../config/tuning';
import { clamp } from '../core/Math';

/**
 * The pickup moment, stub form: time dilation + FOV punch envelopes.
 * M5 replaces the spectacle; this timing skeleton is permanent.
 *
 * DETERMINISM CONTRACT: ticks on RAW fixed-step time, handed in by Game once
 * per sim step. Dilation is only ever a scale applied to the dt that sim
 * consumers receive — it never touches the accumulator or the fixed step, so
 * the harness steps through the whole window identically on every run.
 */
export class PickupFx {
  private dilationRemaining = 0;
  private fovTimer = Infinity; // Infinity = idle

  trigger(): void {
    this.dilationRemaining = TUNING.elements.pickupTimeDilation.duration;
    this.fovTimer = 0;
  }

  /** Called once per fixed step with RAW (unscaled) dt. */
  update(rawDt: number): void {
    this.dilationRemaining = Math.max(0, this.dilationRemaining - rawDt);
    this.fovTimer += rawDt;
  }

  /** Scale for the dt handed to sim consumers this step. */
  get timeScale(): number {
    return this.dilationRemaining > 0 ? TUNING.elements.pickupTimeDilation.scale : 1;
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
