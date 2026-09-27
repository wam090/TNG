import * as THREE from 'three';
import { DEG2RAD } from '../../core/Math';
import type { Vec3Tuple } from '../SchemaUtil';

/**
 * A trigger box: BOTTOM-centred at `pos` (it stands on the ground like the
 * props that own it), `size` = [width x, height y, depth z] in its own frame,
 * rotated `rotY` degrees about +Y. Pure geometry, no identity.
 */
export class Volume {
  private readonly inverse = new THREE.Matrix4();
  private readonly local = new THREE.Vector3();

  constructor(
    readonly pos: Vec3Tuple,
    readonly size: Vec3Tuple,
    readonly rotY = 0,
  ) {
    const world = new THREE.Matrix4()
      .makeRotationY(rotY * DEG2RAD)
      .setPosition(pos[0], pos[1], pos[2]);
    this.inverse.copy(world).invert();
  }

  contains(point: THREE.Vector3): boolean {
    this.local.copy(point).applyMatrix4(this.inverse);
    return (
      Math.abs(this.local.x) <= this.size[0] / 2 &&
      Math.abs(this.local.z) <= this.size[2] / 2 &&
      this.local.y >= 0 &&
      this.local.y <= this.size[1]
    );
  }

  /** The volume's local +Z axis in world space (a fan's blowing direction). */
  forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotY * DEG2RAD);
  }
}
