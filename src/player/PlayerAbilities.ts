import type * as THREE from 'three';
import type { AbilityContext, AbilityWorld } from '../abilities/Ability';
import { AbilityRunner } from '../abilities/AbilityRunner';
import type { InputSnapshot } from '../core/Input';
import type { AbilitySpec, Tag } from '../elements/ElementModule';
import type { CharacterController } from './CharacterController';
import type { PlayerState } from './PlayerStateMachine';
import type { PlayerStats } from './PlayerStats';

/** World-side doors abilities may use; main.ts wires them (inert defaults for tests). */
export type AbilityHooks = Pick<AbilityWorld, 'pushCone' | 'hitStop'>;

/**
 * The player's ability plumbing, element-blind: builds the per-step
 * AbilityContext, runs the AbilityRunner, and hands back this step's stats
 * (resolved stats + active overrides). The player's own impulses go through
 * the controller's mass path; pushes and hit-stop go out through hooks.
 */
export class PlayerAbilities {
  private readonly runner = new AbilityRunner();
  private hooks: AbilityHooks = { pushCone: () => 0, hitStop: () => undefined };
  private readonly world: AbilityWorld;

  constructor(private readonly controller: CharacterController) {
    this.world = {
      applyImpulse: (j: THREE.Vector3): void => {
        this.controller.applyImpulse(j);
      },
      pushCone: (e, range, coneDeg) => this.hooks.pushCone(e, range, coneDeg),
      hitStop: (duration: number): void => {
        this.hooks.hitStop(duration);
      },
    };
  }

  setHooks(hooks: AbilityHooks): void {
    this.hooks = hooks;
  }

  setAbilities(specs: readonly AbilitySpec[]): void {
    this.runner.setAbilities(specs);
  }

  /** Run abilities for one step (BEFORE the controller); returns this step's stats. */
  step(
    dt: number,
    snap: InputSnapshot,
    move: { x: number; z: number },
    yaw: number,
    stats: PlayerStats,
    tags: readonly Tag[],
  ): PlayerStats {
    const c = this.controller;
    const ctx: AbilityContext = {
      grounded: c.grounded,
      verticalVelocity: c.velocity.y,
      airTime: c.airTime,
      feet: c.position,
      facing: { x: Math.sin(yaw), z: Math.cos(yaw) },
      moveDir: move,
      jumpPressed: snap.jumpPressed,
      jumpHeld: snap.jumpHeld,
      actionPressed: snap.actionPressed,
      stats,
      tags,
      groundWithin: (d) => c.groundWithin(d),
    };
    this.runner.update(dt, ctx, this.world);
    return { ...stats, ...this.runner.statOverrides(ctx) };
  }

  get activeState(): PlayerState | null {
    return this.runner.activeState;
  }

  isActive(id: string): boolean {
    return this.runner.isActive(id);
  }
}
