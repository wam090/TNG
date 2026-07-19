import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export interface ColliderHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
}

export interface CapsuleSweepResult {
  /** Final safe feet position after moving toward `end` with depenetration. */
  position: THREE.Vector3;
  collided: boolean;
  /** Contact normals encountered (deduplicated-ish, for velocity sliding). */
  normals: THREE.Vector3[];
}

const DOWN = new THREE.Vector3(0, -1, 0);

// Depenetration invariant: per sub-move, feet may sink at most half the
// capsule radius into a surface, which keeps the capsule's bottom-sphere
// centre on the correct side of any face it penetrates — so the push-out
// direction is always outward, never through. This is what the thin-platform
// tunnelling test (CharacterController.test.ts) arbitrates.
const MAX_SUBMOVE_FRACTION = 0.5; // of radius
const MAX_DEPEN_PASSES = 3;
const EPS = 1e-10;

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
   * Move a capsule (feet at `start`) toward `end` (feet position), resolving
   * penetration against the static world along the way. Sub-moves are capped
   * to a fraction of the radius so fast motion cannot skip through geometry
   * (see MAX_SUBMOVE_FRACTION). Deterministic: same inputs, same result.
   */
  capsuleSweep(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    height: number,
  ): CapsuleSweepResult {
    const position = start.clone();
    const delta = end.clone().sub(start);
    const totalDist = delta.length();
    const normals: THREE.Vector3[] = [];
    let collided = false;

    const maxSub = radius * MAX_SUBMOVE_FRACTION;
    const steps = Math.max(1, Math.ceil(totalDist / maxSub));
    const step = delta.divideScalar(steps);

    for (let i = 0; i < steps; i += 1) {
      position.add(step);
      if (this.depenetrateCapsule(position, radius, height, normals)) collided = true;
    }
    return { position, collided, normals };
  }

  /** Push a capsule (feet at `feet`, mutated in place) out of the world. Returns true if it touched anything. */
  private depenetrateCapsule(
    feet: THREE.Vector3,
    radius: number,
    height: number,
    outNormals: THREE.Vector3[],
  ): boolean {
    const segment = new THREE.Line3();
    const aabb = new THREE.Box3();
    const triPoint = new THREE.Vector3();
    const capPoint = new THREE.Vector3();
    let touched = false;

    for (let pass = 0; pass < MAX_DEPEN_PASSES; pass += 1) {
      segment.start.set(feet.x, feet.y + radius, feet.z);
      segment.end.set(feet.x, feet.y + height - radius, feet.z);
      aabb.makeEmpty();
      aabb.expandByPoint(segment.start);
      aabb.expandByPoint(segment.end);
      aabb.min.addScalar(-radius);
      aabb.max.addScalar(radius);

      const beforeX = feet.x;
      const beforeY = feet.y;
      const beforeZ = feet.z;
      this.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(aabb),
        intersectsTriangle: (tri) => {
          const dist = tri.closestPointToSegment(segment, triPoint, capPoint);
          if (dist < radius) {
            const depth = radius - dist;
            const dir =
              dist > EPS
                ? capPoint.clone().sub(triPoint).divideScalar(dist)
                : tri.getNormal(new THREE.Vector3());
            segment.start.addScaledVector(dir, depth);
            segment.end.addScaledVector(dir, depth);
            feet.addScaledVector(dir, depth);
            outNormals.push(dir);
            touched = true;
          }
          return false; // keep visiting triangles
        },
      });
      if (feet.x === beforeX && feet.y === beforeY && feet.z === beforeZ) break;
    }
    return touched;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
