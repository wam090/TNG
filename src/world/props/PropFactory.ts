import type * as THREE from 'three';
import type { Materials } from '../../render/Materials';
import type { PropData } from '../PropSchema';
import type { Prop } from './Prop';
import { Windmill } from './Windmill';

export interface PropDeps {
  scene: THREE.Scene;
  materials: Materials;
}

/** Validated prop JSON → a live prop. */
export function createProp(data: PropData, deps: PropDeps): Prop {
  return new Windmill(data, deps.scene, deps.materials);
}
