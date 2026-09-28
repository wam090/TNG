import * as THREE from 'three';
import { disposeGizmo, GIZMO_COLOR } from './PropGizmos';
import type { PushBounds } from './PushCone';

const ARC_SEGMENTS = 24;

export interface PushGizmoTarget {
  bounds: PushBounds;
  hit: boolean;
}

/**
 * F3 view of the last push (WO-004 A1c): the reach wedge (range × half-angle,
 * at the push's height) plus every pushable's bounds flashed green (hit) or
 * red (miss). Debug-only; lives in Level's F3 gizmo group.
 */
export class PushGizmo {
  readonly group = new THREE.Group();
  private remaining = 0;

  constructor() {
    this.group.name = 'push-gizmo';
    this.group.visible = false;
  }

  show(
    origin: THREE.Vector3,
    aim: THREE.Vector3,
    range: number,
    halfDeg: number,
    targets: readonly PushGizmoTarget[],
    seconds: number,
  ): void {
    this.clear();
    this.group.add(this.wedge(origin, aim, range, halfDeg));
    for (const t of targets) this.group.add(this.flash(t));
    this.remaining = seconds;
    this.group.visible = seconds > 0;
  }

  /** World (dilation-scaled) time, like the push it shows. */
  update(dt: number): void {
    if (this.remaining <= 0) return;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining === 0) this.group.visible = false;
  }

  clear(): void {
    for (const child of [...this.group.children]) disposeGizmo(child);
  }

  private wedge(origin: THREE.Vector3, aim: THREE.Vector3, range: number, halfDeg: number): THREE.Line {
    const base = Math.atan2(aim.x, aim.z);
    const half = (halfDeg * Math.PI) / 180;
    const points = [origin.clone()];
    for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
      const a = base - half + (2 * half * i) / ARC_SEGMENTS;
      points.push(new THREE.Vector3(origin.x + Math.sin(a) * range, origin.y, origin.z + Math.cos(a) * range));
    }
    points.push(origin.clone());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: GIZMO_COLOR.active, depthTest: false, transparent: true }),
    );
    line.renderOrder = 999;
    return line;
  }

  private flash(t: PushGizmoTarget): THREE.LineSegments {
    const size = t.bounds.box.getSize(new THREE.Vector3());
    const centre = t.bounds.box.getCenter(new THREE.Vector3());
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    geometry.translate(centre.x, centre.y, centre.z);
    geometry.applyMatrix4(t.bounds.frame);
    const lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: t.hit ? GIZMO_COLOR.done : GIZMO_COLOR.idle,
        depthTest: false,
        transparent: true,
      }),
    );
    lines.renderOrder = 999;
    return lines;
  }
}
