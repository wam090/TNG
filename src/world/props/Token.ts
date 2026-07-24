import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import type { ElementId } from '../../elements/ElementModule';

export interface TokenSpec {
  id: string;
  element: ElementId;
  pos: [number, number, number];
}

// Overlap is tested against the capsule's mid-height, not the feet.
const OVERLAP_HEIGHT = 0.65;

/**
 * A floating, slowly-rotating elemental Core. Element-AGNOSTIC: it carries an
 * ElementId as opaque data and a colour handed in by its creator — this file
 * never names an element (the props lint tripwire stays unreachable).
 * Sim-stepped and deterministic; despawns on pickup.
 */
export class Token {
  private readonly mesh: THREE.Mesh;
  private phase = 0;
  private pickedUp = false;

  constructor(
    readonly spec: TokenSpec,
    colorHex: string,
    private readonly scene: THREE.Scene,
    private readonly onPickup: (spec: TokenSpec) => void,
  ) {
    const T = TUNING.props.token;
    this.mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(T.visualRadius),
      new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0,
      }),
    );
    this.mesh.name = `token:${spec.id}`;
    this.mesh.position.set(...spec.pos);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  /** One fixed sim step (world/scaled time). playerFeet is the capsule feet position. */
  update(dt: number, playerFeet: THREE.Vector3): void {
    if (this.pickedUp) return;
    const T = TUNING.props.token;
    this.phase = (this.phase + dt) % T.bobPeriod;
    this.mesh.rotation.y += T.spinRate * dt;
    this.mesh.position.y = this.spec.pos[1] + Math.sin((this.phase / T.bobPeriod) * Math.PI * 2) * T.bobAmp;

    const dx = this.mesh.position.x - playerFeet.x;
    const dy = this.mesh.position.y - (playerFeet.y + OVERLAP_HEIGHT);
    const dz = this.mesh.position.z - playerFeet.z;
    if (dx * dx + dy * dy + dz * dz <= T.pickupRadius * T.pickupRadius) {
      this.pickedUp = true;
      this.dispose();
      this.onPickup(this.spec);
    }
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
