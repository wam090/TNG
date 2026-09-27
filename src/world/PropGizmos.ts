import * as THREE from 'three';
import type { Vec3Tuple } from './SchemaUtil';

// F3 debug colours (CLAUDE.md rule 10). Drawn X-ray, like F2's wireframe.
export const GIZMO_COLOR = {
  volume: '#4FC3F7', // trigger volumes
  idle: '#FF5A52', // waiting for an event / signal
  active: '#FFD166', // reacting (spinning, pulsing, opening)
  done: '#39FF6A', // latched / fired / open / collected
} as const;

function lineMaterial(color: string): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
}

/** Wireframe box, bottom-centred at the origin (matches volume-prop `pos` convention). */
export function wireBox(size: Vec3Tuple, color: string): THREE.LineSegments {
  const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(...size));
  geometry.translate(0, size[1] / 2, 0);
  const lines = new THREE.LineSegments(geometry, lineMaterial(color));
  lines.renderOrder = 999;
  return lines;
}

/** Wireframe sphere centred at the origin. */
export function wireSphere(radius: number, color: string): THREE.LineSegments {
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(radius, 1)),
    lineMaterial(color),
  );
  lines.renderOrder = 999;
  return lines;
}

/** Direction arrow from the origin. */
export function arrow(dir: THREE.Vector3, length: number, color: string): THREE.ArrowHelper {
  const helper = new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(), length, color);
  helper.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
      (o.material as THREE.Material).depthTest = false;
      o.renderOrder = 999;
    }
  });
  return helper;
}

/** Recolour every line/mesh in a gizmo (state feedback). */
export function setGizmoColor(obj: THREE.Object3D, color: string): void {
  obj.traverse((o) => {
    if (o instanceof THREE.LineSegments || o instanceof THREE.Mesh || o instanceof THREE.Line) {
      const m = o.material as THREE.LineBasicMaterial | THREE.MeshBasicMaterial;
      m.color.set(color);
    }
  });
}

/** Free a gizmo's geometry and materials. */
export function disposeGizmo(obj: THREE.Object3D): void {
  obj.removeFromParent();
  obj.traverse((o) => {
    if (o instanceof THREE.LineSegments || o instanceof THREE.Mesh || o instanceof THREE.Line) {
      (o.geometry as THREE.BufferGeometry).dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}
