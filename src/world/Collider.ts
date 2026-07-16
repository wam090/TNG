import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export interface ColliderHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
}

const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Static world collision: one merged, world-space BufferGeometry with a BVH
 * over it. Raycasts only at M1 — the capsule sweep lands at M2.
 */
export class Collider {
  readonly geometry: THREE.BufferGeometry;
  private readonly bvh: MeshBVH;
  private readonly ray = new THREE.Ray();

  constructor(mergedWorldGeometry: THREE.BufferGeometry) {
    this.geometry = mergedWorldGeometry;
    this.bvh = new MeshBVH(mergedWorldGeometry);
  }

  /** First hit along a ray, or null. `dir` need not be normalised. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDistance = Infinity): ColliderHit | null {
    this.ray.origin.copy(origin);
    this.ray.direction.copy(dir).normalize();
    const hit = this.bvh.raycastFirst(this.ray, THREE.DoubleSide);
    if (!hit || hit.distance > maxDistance) return null;
    return {
      point: hit.point.clone(),
      normal: hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0),
      distance: hit.distance,
    };
  }

  /** Straight-down probe — where would something at `origin` land? */
  groundProbe(origin: THREE.Vector3, maxDistance = Infinity): ColliderHit | null {
    return this.raycast(origin, DOWN, maxDistance);
  }

  /**
   * M2: sweep the player capsule against the world and resolve sliding.
   * Signature reserved now so the controller has a stable surface to build on.
   */
  capsuleSweep(_start: THREE.Vector3, _end: THREE.Vector3, _radius: number, _height: number): never {
    throw new Error('Collider.capsuleSweep is not implemented until M2');
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
