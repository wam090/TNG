import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { InputSnapshot } from '../core/Input';
import { DEG2RAD, damp, lerpAngle } from '../core/Math';
import type { Collider } from '../world/Collider';
import { buildChassis, type Chassis } from './ChassisBuilder';
import { CharacterController } from './CharacterController';
import type { PlayerStats } from './PlayerStats';
import { PlayerStateMachine, type PlayerState } from './PlayerStateMachine';
import { ProcAnim } from './ProcAnim';

/** Camera-relative input (SPEC §4.2): rotate the stick vector by the fixed camera yaw. */
export function inputToWorld(x: number, y: number): { x: number; z: number } {
  const yaw = TUNING.camera.yawDeg * DEG2RAD;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  // Vector3(x, 0, y).applyAxisAngle(UP, yaw), expanded.
  return { x: x * cos + y * sin, z: -x * sin + y * cos };
}

const BLOB_COLOR = '#101216';
const BLOB_SURFACE_OFFSET = 0.02; // lift above the surface to avoid z-fighting

/**
 * The player entity: stats + controller + chassis + state machine + anim.
 * Elements arrive at M3 as a private loadout; nothing here exposes element
 * identity to the outside world, and it must stay that way.
 */
export class Player {
  readonly stats: PlayerStats = { ...TUNING.player.baseStats };

  private readonly controller: CharacterController;
  private readonly chassis: Chassis;
  private readonly stateMachine = new PlayerStateMachine();
  private readonly anim = new ProcAnim();
  private readonly blob: THREE.Mesh;
  private readonly spawn = new THREE.Vector3();

  // Interpolation pair: sim writes curr, render lerps prev→curr by alpha.
  private readonly prevPos = new THREE.Vector3();
  private readonly currPos = new THREE.Vector3();
  private prevYaw = 0;
  private currYaw = 0;
  private fadeTimer = 0;

  private readonly renderPos = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private readonly getCollider: () => Collider | null,
  ) {
    this.controller = new CharacterController(getCollider);
    this.chassis = buildChassis();
    scene.add(this.chassis.root);

    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(TUNING.player.landingBlob.radius),
      new THREE.MeshBasicMaterial({
        color: BLOB_COLOR,
        transparent: true,
        opacity: TUNING.player.landingBlob.opacity,
        depthWrite: false,
      }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);
  }

  /** Place the player (feet) and make it the new respawn point. */
  spawnAt(feet: THREE.Vector3): void {
    this.spawn.copy(feet);
    this.controller.teleport(feet);
    this.resetInterpolation();
  }

  /** Move only the respawn point (level hot-reload keeps the player in place). */
  setSpawn(feet: THREE.Vector3): void {
    this.spawn.copy(feet);
  }

  /** One fixed sim step. */
  update(dt: number, snap: InputSnapshot): void {
    this.prevPos.copy(this.currPos);
    this.prevYaw = this.currYaw;

    const move = inputToWorld(snap.move.x, snap.move.y);
    const events = this.controller.update(dt, {
      x: move.x,
      z: move.z,
      jumpPressed: snap.jumpPressed,
      jumpHeld: snap.jumpHeld,
    }, this.stats);

    // Face the velocity direction (visual only).
    const speed = this.controller.horizontalSpeed;
    if (speed > TUNING.player.anim.runThreshold) {
      const targetYaw = Math.atan2(this.controller.velocity.x, this.controller.velocity.z);
      this.currYaw = lerpAngle(this.currYaw, targetYaw, damp(this.stats.turnSpeed, dt));
    }

    const state = this.stateMachine.update(dt, {
      grounded: this.controller.grounded,
      verticalVelocity: this.controller.velocity.y,
      horizontalSpeed: speed,
      jumped: events.jumped,
      landed: events.landed,
    });
    this.anim.update(dt, {
      state,
      horizontalSpeed: speed,
      maxSpeed: this.stats.moveSpeed,
      jumped: events.jumped,
      landed: events.landed,
    });

    // Fell out of the world → instant respawn behind a short fade.
    this.fadeTimer = Math.max(0, this.fadeTimer - dt);
    if (this.controller.position.y < TUNING.player.respawnFallY) {
      this.controller.teleport(this.spawn);
      this.resetInterpolation();
      this.fadeTimer = TUNING.player.respawnFade;
    }

    this.currPos.copy(this.controller.position);
  }

  /** Render-side: apply interpolated transform + pose + landing blob. */
  syncVisual(alpha: number): void {
    this.renderPos.lerpVectors(this.prevPos, this.currPos, alpha);
    this.chassis.root.position.copy(this.renderPos);
    this.chassis.root.rotation.y = lerpAngle(this.prevYaw, this.currYaw, alpha);
    this.anim.apply(this.chassis.body);

    const hit = this.getCollider()?.groundProbe(
      this.renderPos.clone().add(CharacterController.upAxis().multiplyScalar(TUNING.player.radius)),
    );
    if (hit) {
      this.blob.visible = true;
      this.blob.position.set(this.renderPos.x, hit.point.y + BLOB_SURFACE_OFFSET, this.renderPos.z);
    } else {
      this.blob.visible = false;
    }
  }

  private resetInterpolation(): void {
    this.currPos.copy(this.controller.position);
    this.prevPos.copy(this.currPos);
  }

  get state(): PlayerState {
    return this.stateMachine.current;
  }

  get position(): THREE.Vector3 {
    return this.controller.position;
  }

  get velocity(): THREE.Vector3 {
    return this.controller.velocity;
  }

  get grounded(): boolean {
    return this.controller.grounded;
  }

  get renderPosition(): THREE.Vector3 {
    return this.renderPos;
  }

  /** 0..1 black-overlay opacity for the respawn fade. */
  get fadeOpacity(): number {
    return this.fadeTimer / TUNING.player.respawnFade;
  }
}
