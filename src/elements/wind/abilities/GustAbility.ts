import * as THREE from 'three';
import type { Ability, AbilityContext, AbilityWorld } from '../../../abilities/Ability';
import { TUNING } from '../../../config/tuning';
import type { PushEvent } from '../../../core/Events';

/**
 * Gust (SPEC §2.1): a directed cone of air. Press → windup → FIRE: every
 * pushable in the cone gets a PushEvent (force, not identity); if anything
 * was hit, the sim hit-stops; in the air the body recoils opposite the aim
 * through the mass path (impulse ÷ mass). Aim = move input, else facing.
 * Horizontal only in M4a — downward aim (Beat 5's shard) is an open M4b call.
 */
export class GustAbility implements Ability {
  readonly id = 'gust';
  readonly cooldown = TUNING.wind.gust.cooldown;
  readonly state = 'gust' as const;

  private t = 0;
  private fired = false;
  private readonly aim = new THREE.Vector3();

  canUse(s: AbilityContext): boolean {
    return s.actionPressed;
  }

  start(s: AbilityContext): void {
    this.t = 0;
    this.fired = false;
    const useInput = s.moveDir.x !== 0 || s.moveDir.z !== 0;
    const src = useInput ? s.moveDir : s.facing;
    this.aim.set(src.x, 0, src.z).normalize();
  }

  update(dt: number, s: AbilityContext, w: AbilityWorld): boolean {
    const G = TUNING.wind.gust;
    this.t += dt;
    if (!this.fired && this.t >= G.windup) {
      this.fired = true;
      this.fire(s, w);
    }
    return this.t < G.windup + G.duration;
  }

  end(): void {
    this.fired = true;
  }

  /** Fire the cone. Public for tests; the runner only ever reaches it via update(). */
  fire(s: AbilityContext, w: AbilityWorld): void {
    const G = TUNING.wind.gust;
    const origin = s.feet.clone();
    origin.y += TUNING.player.height / 2; // from the body's centre, not the feet
    const e: PushEvent = { origin, dir: this.aim.clone(), force: G.force, tags: s.tags };
    if (w.pushCone(e, G.range, G.coneHalfDeg, G.duration) > 0) w.hitStop(G.hitStop);
    const recoil = s.grounded ? G.selfImpulseGround : G.selfImpulseAir;
    if (recoil > 0) w.applyImpulse(this.aim.clone().multiplyScalar(-recoil));
  }

  get aimDirection(): Readonly<THREE.Vector3> {
    return this.aim;
  }
}
