import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import { clamp, damp } from '../core/Math';
import { DEG2RAD } from '../core/Math';
import type { PlayerState } from './PlayerStateMachine';

export interface AnimContext {
  state: PlayerState;
  horizontalSpeed: number;
  maxSpeed: number;
  jumped: boolean;
  landed: boolean;
}

const ONE = new THREE.Vector3(1, 1, 1);
const TWO_PI = Math.PI * 2;

/**
 * Procedural squash/stretch/lean/bob (SPEC §3.4). No skeletons, ever.
 * Sim-stepped at fixed dt so harness runs are deterministic; apply() writes
 * the current pose onto the body group (pivoted at the feet).
 */
export class ProcAnim {
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private lean = 0;
  private bobPhase = 0;
  private bob = 0;

  update(dt: number, ctx: AnimContext): void {
    const A = TUNING.player.anim;
    const squash = TUNING.player.squash;

    if (ctx.jumped) this.scale.set(...squash.jump);
    if (ctx.landed) this.scale.set(...squash.land);
    this.scale.lerp(ONE, damp(squash.recover, dt));

    const targetLean =
      clamp(ctx.horizontalSpeed / ctx.maxSpeed, 0, 1) * A.leanMaxDeg * DEG2RAD;
    this.lean += (targetLean - this.lean) * damp(A.leanStiffness, dt);

    this.bobPhase = (this.bobPhase + dt) % A.idleBobPeriod;
    const targetBob =
      ctx.state === 'idle' ? Math.sin((this.bobPhase / A.idleBobPeriod) * TWO_PI) * A.idleBobAmp : 0;
    this.bob += (targetBob - this.bob) * damp(A.leanStiffness, dt);
  }

  /** Write the pose onto the body group. Root yaw already faces velocity, so lean is a local forward pitch. */
  apply(body: THREE.Object3D): void {
    body.scale.copy(this.scale);
    body.rotation.x = this.lean;
    body.position.y = this.bob;
  }
}
