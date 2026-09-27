import type { Ability, AbilityContext } from '../../../abilities/Ability';
import { TUNING } from '../../../config/tuning';
import type { PlayerStats } from '../../../player/PlayerStats';

const NO_COOLDOWN = 0;

/**
 * Glide (SPEC §2.1): hold Jump while falling → slow descent.
 * Engages on a NEW jump press while airborne and falling, after minAirTime —
 * so the jump's own held button can never auto-glide at the apex, and coyote
 * jumps (coyoteTime < minAirTime) always stay jumps. Sustained while Jump is
 * held and airborne. If the ground is close enough that the press would be
 * consumed by the jump buffer on landing, the buffered jump wins.
 */
export class GlideAbility implements Ability {
  readonly id = 'glide';
  readonly cooldown = NO_COOLDOWN;
  readonly state = 'glide' as const;

  canUse(s: AbilityContext): boolean {
    if (s.grounded || !s.jumpPressed || s.verticalVelocity >= 0) return false;
    if (s.airTime < TUNING.wind.glide.minAirTime) return false;
    // Would we land inside the jump-buffer window at the current fall speed?
    const bufferReach = -s.verticalVelocity * TUNING.player.jumpBuffer;
    return !s.groundWithin(bufferReach);
  }

  start(): void {
    // Glide is pure stat override; nothing to set up.
  }

  update(_dt: number, s: AbilityContext): boolean {
    return s.jumpHeld && !s.grounded;
  }

  end(): void {
    // Overrides stop applying the moment the runner marks the ability inactive.
  }

  /**
   * glide.horizontalDrag has no unit in SPEC §9. Read (frame-rate-independent,
   * pending a DM ruling) as: glide horizontal speed = moveSpeed × horizontalDrag.
   */
  statOverrides(s: AbilityContext): Partial<PlayerStats> {
    const GL = TUNING.wind.glide;
    return {
      maxFallSpeed: GL.maxFallSpeed,
      airControl: GL.airControl,
      moveSpeed: s.stats.moveSpeed * GL.horizontalDrag,
    };
  }
}
