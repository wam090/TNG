import * as THREE from 'three';
import type { AttachmentSpec, PlayerRuntimeState } from '../elements/ElementModule';

// SPEC §3.2 — the morph rig. Elements bolt meshes onto these anchors at M3+.
// Offsets are structural rig geometry (like the chassis proportions), not feel
// tunables — they live here as named constants, local to the body group.
export type SocketId =
  | 'crown' // above head — rotors, flames, halos
  | 'head'
  | 'chest' // core gem / element crystal
  | 'back' // wings, shell, fins
  | 'orbitLow' // waist-height orbital ring
  | 'orbitHigh' // shoulder-height orbital ring
  | 'feet' // ground contact FX
  | 'trail' // behind, for motion trails
  | 'handL'
  | 'handR'; // reserved, unused in v1

export const SOCKET_OFFSETS: Record<SocketId, readonly [number, number, number]> = {
  crown: [0, 1.62, 0],
  head: [0, 1.27, 0],
  chest: [0, 0.85, 0],
  back: [0, 0.75, -0.32],
  orbitLow: [0, 0.5, 0],
  orbitHigh: [0, 1.0, 0],
  feet: [0, 0.02, 0],
  trail: [0, 0.55, -0.5],
  handL: [-0.45, 0.72, 0],
  handR: [0.45, 0.72, 0],
};

interface AttachedInstance {
  spec: AttachmentSpec;
  object: THREE.Object3D;
  socket: THREE.Object3D;
}

/**
 * Attach/detach AttachmentSpecs onto the chassis sockets, keyed by an opaque
 * owner string (the module id — the rig never interprets it). detach() fully
 * disposes what build() created: reversibility is a hard contract here
 * (swap-puzzles depend on grant→revoke leaving zero residue).
 */
export class SocketRig {
  private readonly instances = new Map<string, AttachedInstance[]>();

  constructor(private readonly sockets: ReadonlyMap<SocketId, THREE.Object3D>) {}

  attach(ownerKey: string, specs: readonly AttachmentSpec[]): void {
    if (this.instances.has(ownerKey)) this.detach(ownerKey);
    const list: AttachedInstance[] = specs.map((spec) => {
      const socket = this.sockets.get(spec.socket);
      if (!socket) throw new Error(`SocketRig: unknown socket "${spec.socket}"`);
      const object = spec.build({ socket });
      socket.add(object);
      return { spec, object, socket };
    });
    this.instances.set(ownerKey, list);
  }

  detach(ownerKey: string): void {
    const list = this.instances.get(ownerKey);
    if (!list) return;
    for (const { object, socket } of list) {
      socket.remove(object);
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.geometry as THREE.BufferGeometry).dispose();
          const material = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) for (const m of material) m.dispose();
          else material.dispose();
        }
      });
    }
    this.instances.delete(ownerKey);
  }

  detachAll(): void {
    for (const key of [...this.instances.keys()]) this.detach(key);
  }

  update(dt: number, state: PlayerRuntimeState): void {
    for (const list of this.instances.values()) {
      for (const { spec, object } of list) spec.animate?.(object, dt, state);
    }
  }
}
