import * as THREE from 'three';

// The world palette. Named constants only — level JSON refers to these by
// name, never by hex. Grey-white and muted: the world starts as inert as you.
const PALETTE = {
  stone: '#A8ABAD', // mid grey — ground, ramps, cliff mass
  pillar: '#CFC9BD', // warm off-white — pedestals, standing stones
  metal: '#7F8A92', // cool dark grey — mechanisms, gates, shafts
  accent: '#C2453A', // muted red — markers, the M1 camera-target stand-in
} as const;

export type MaterialName = keyof typeof PALETTE;

const ROUGHNESS = 0.9; // flat matte world
const METALNESS = 0;

const NAMES = Object.keys(PALETTE) as MaterialName[];

/** Shared, lazily-created flat-matte materials. One instance per name — do not dispose per-mesh. */
export class Materials {
  private readonly cache = new Map<MaterialName, THREE.MeshStandardMaterial>();

  static isName(value: string): value is MaterialName {
    return (NAMES as string[]).includes(value);
  }

  static get names(): readonly MaterialName[] {
    return NAMES;
  }

  get(name: MaterialName): THREE.MeshStandardMaterial {
    let mat = this.cache.get(name);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: PALETTE[name],
        roughness: ROUGHNESS,
        metalness: METALNESS,
      });
      this.cache.set(name, mat);
    }
    return mat;
  }

  dispose(): void {
    for (const mat of this.cache.values()) mat.dispose();
    this.cache.clear();
  }
}
