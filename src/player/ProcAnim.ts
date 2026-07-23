import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import { clamp, damp, DEG2RAD } from '../core/Math';
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
 * Sim-stepped at fixed dt for determinism; all channels keep prev/curr pairs
 * so apply() can interpolate the pose by the same render alpha as the
 * position — a 60Hz pose stairsteps visibly on any other refresh rate.
 */
export class ProcAnim {
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly prevScale = new THREE.Vector3(1, 1, 1);
  private lean = 0;
  private prevLean = 0;
  private bobPhase = 0;
  private bob = 0;
  private prevBob = 0;

  private readonly renderScale = new THREE.Vector3();

  update(dt: number, ctx: AnimContext): void {
    this.prevScale.copy(this.scale);
    this.prevLean = this.lean;
    this.prevBob = this.bob;

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

  /** Write the interpolated pose onto the body group (alpha as for position). */
  apply(body: THREE.Object3D, alpha: number): void {
    this.renderScale.lerpVectors(this.prevScale, this.scale, alpha);
    body.scale.copy(this.renderScale);
    body.rotation.x = this.prevLean + (this.lean - this.prevLean) * alpha;
    body.position.y = this.prevBob + (this.bob - this.prevBob) * alpha;
  }
}
