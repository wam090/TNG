import * as THREE from 'three';
import type { Collider } from './Collider';

/**
 * Level-authoring tool (dev builds only): click the world → hit point as
 * "[x, y, z]" (2 decimals) copied to the clipboard AND logged. Hand-writing
 * JSON coordinates is unbearable without this.
 */
export function installCoordPicker(
  dom: HTMLElement,
  camera: THREE.Camera,
  getCollider: () => Collider | null,
): void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  dom.addEventListener('click', (e: MouseEvent) => {
    const collider = getCollider();
    if (!collider) return;
    const rect = dom.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = collider.raycast(raycaster.ray.origin, raycaster.ray.direction);
    if (!hit) return;

    const text = `[${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)}]`;
    console.log(`[pick] ${text}`);
    navigator.clipboard.writeText(text).catch(() => {
      console.warn('[pick] clipboard unavailable — copy from the log line above');
    });
  });
}
