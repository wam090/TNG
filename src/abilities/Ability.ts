import type * as THREE from 'three';
import type { PushEvent } from '../core/Events';
import type { Tag } from '../elements/ElementModule';
import type { PlayerState } from '../player/PlayerStateMachine';
import type { PlayerStats } from '../player/PlayerStats';

/** What an ability may read about the player this step. Read-only, no identity. */
export interface AbilityContext {
  grounded: boolean;
  verticalVelocity: number;
  /** Seconds since last grounded (0 while grounded). */
  airTime: number;
  feet: THREE.Vector3;
  /** Unit world-space facing (horizontal). */
  facing: { x: number; z: number };
  /** World-space move input, length <= 1. */
  moveDir: { x: number; z: number };
  jumpPressed: boolean;
  jumpHeld: boolean;
  actionPressed: boolean;
  stats: PlayerStats;
  tags: readonly Tag[];
  groundWithin(distance: number): boolean;
}

/** What an ability may DO. These are the only doors out of an ability. */
export interface AbilityWorld {
  /** Push the player through the mass path: Δv = impulse ÷ mass. */
  applyImpulse(impulse: THREE.Vector3): void;
  /**
   * Deliver `e` to every pushable within `range` and ±`coneHalfDeg` of its
   * aim; returns how many were hit. A debug view may show it for `debugShowFor` s.
   */
  pushCone(e: PushEvent, range: number, coneHalfDeg: number, debugShowFor: number): number;
  /** Freeze the sim briefly via the shared TimeScale (MIN-combined with dilation). */
  hitStop(duration: number): void;
}

/**
 * SPEC §8.6. One deviation: update() returns false when the ability has
 * finished, so the runner knows when to call end() — §8.6 left that implicit.
 */
export interface Ability {
  readonly id: string;
  readonly cooldown: number;
  /** Player state reported while active (F1, harness, pose). */
  readonly state?: PlayerState;
  /** Trigger + preconditions. Checked only while inactive and off cooldown. */
  canUse(s: AbilityContext): boolean;
  start(s: AbilityContext, w: AbilityWorld): void;
  update(dt: number, s: AbilityContext, w: AbilityWorld): boolean;
  end(s: AbilityContext): void;
  /** Absolute per-step stat overrides while active (same semantics as statMods). */
  statOverrides?(s: AbilityContext): Partial<PlayerStats>;
}
