import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import { DEG2RAD, damp } from '../core/Math';

/**
 * Fixed-angle perspective rig: yaw/pitch/distance never change; only the
 * focus point moves, chasing the target with frame-rate-independent damping
 * plus a horizontal look-ahead in the direction of travel (SPEC §4.4).
 * Look-ahead is horizontal-only: vertical look-ahead dives on falls.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly offset: THREE.Vector3;
  private readonly focus = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private initialised = false;

  constructor(aspect: number) {
    const C = TUNING.camera;
    this.camera = new THREE.PerspectiveCamera(C.fov, aspect, C.near, C.far);

    const yaw = C.yawDeg * DEG2RAD;
    const pitch = C.pitchDeg * DEG2RAD;
    const horizontal = Math.cos(pitch) * C.distance;
    this.offset = new THREE.Vector3(
      Math.sin(yaw) * horizontal,
      Math.sin(pitch) * C.distance,
      Math.cos(yaw) * horizontal,
    );
  }

  update(focusTarget: THREE.Vector3, velocity: THREE.Vector3, dt: number): void {
    const C = TUNING.camera;
    this.desired.copy(focusTarget);
    this.desired.y += C.heightOffset;
    this.desired.x += velocity.x * C.lookAheadFactor;
    this.desired.z += velocity.z * C.lookAheadFactor;

    if (this.initialised) {
      this.focus.lerp(this.desired, damp(C.followStiffness, dt));
    } else {
      this.focus.copy(this.desired); // first frame: snap, don't sweep in from origin
      this.initialised = true;
    }
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
  }
}
