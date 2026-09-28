import * as THREE from 'three';
import { RAD2DEG } from '../core/Math';

/**
 * What a push can hit: a box in the prop's LOCAL frame, placed in the world
 * by `frame` (translation + rotation about Y only, no scale). Reach is tested
 * against these bounds, not a single point, so the same distance to a prop's
 * visible edge registers the same on every prop (WO-004 A1).
 */
export interface PushBounds {
  box: THREE.Box3;
  frame: THREE.Matrix4;
}

export interface PushReach {
  /** 3D distance from the push origin to the nearest point of the bounds. */
  distance: number;
  /** Smallest horizontal angle (degrees) between the aim and any part of the bounds. */
  angleDeg: number;
}

const flatAngle = (a: THREE.Vector3, b: THREE.Vector3): number =>
  Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);

/** Distance and angle from a push origin (aimed along horizontal `aim`) to a prop's bounds. */
export function pushReach(origin: THREE.Vector3, aim: THREE.Vector3, bounds: PushBounds): PushReach {
  const inverse = bounds.frame.clone().invert();
  const local = origin.clone().applyMatrix4(inverse);
  const nearest = bounds.box.clampPoint(local, new THREE.Vector3()).applyMatrix4(bounds.frame);
  const distance = origin.distanceTo(nearest);

  // Standing over the footprint: every horizontal direction touches it.
  const { min, max } = bounds.box;
  if (local.x >= min.x && local.x <= max.x && local.z >= min.z && local.z <= max.z) {
    return { distance, angleDeg: 0 };
  }
  // Angular span of the footprint seen from the origin, measured around the
  // direction to its centre (a convex box outside the origin spans < 180°).
  const centre = bounds.box.getCenter(new THREE.Vector3()).applyMatrix4(bounds.frame).sub(origin);
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of [min.x, max.x]) {
    for (const z of [min.z, max.z]) {
      const corner = new THREE.Vector3(x, 0, z).applyMatrix4(bounds.frame).sub(origin);
      const a = flatAngle(centre, corner);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
  }
  const toCentre = flatAngle(aim, centre);
  const from = toCentre + lo;
  const to = toCentre + hi;
  const angle = from <= 0 && to >= 0 ? 0 : Math.min(Math.abs(from), Math.abs(to));
  return { distance, angleDeg: angle * RAD2DEG };
}

/** A push reaches the bounds if they are within `range` and within ±`halfDeg` of the aim. */
export function pushHits(reach: PushReach, range: number, halfDeg: number): boolean {
  return reach.distance <= range && reach.angleDeg <= halfDeg;
}
