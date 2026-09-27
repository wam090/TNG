import type * as THREE from 'three';
import type { Materials } from '../../render/Materials';
import type { PropData } from '../PropSchema';
import { Checkpoint } from './Checkpoint';
import { Debris } from './Debris';
import { Fan } from './Fan';
import { Gate } from './Gate';
import { Goal } from './Goal';
import type { Prop } from './Prop';
import { Shard } from './Shard';
import { Updraft } from './Updraft';
import { Windmill } from './Windmill';
import { WindZone } from './WindZone';

export interface PropDeps {
  scene: THREE.Scene;
  materials: Materials;
}

/** Validated prop JSON → a live prop. Exhaustive over PropData: a new type fails to compile here. */
export function createProp(data: PropData, deps: PropDeps): Prop {
  const { scene, materials } = deps;
  switch (data.type) {
    case 'windmill':
      return new Windmill(data, scene, materials);
    case 'gate':
      return new Gate(data, scene, materials);
    case 'debris':
      return new Debris(data, scene, materials);
    case 'updraft':
      return new Updraft(data, scene, materials);
    case 'fan':
      return new Fan(data, scene, materials);
    case 'windZone':
      return new WindZone(data, scene);
    case 'checkpoint':
      return new Checkpoint(data, scene, materials);
    case 'shard':
      return new Shard(data, scene, materials);
    case 'goal':
      return new Goal(data, scene);
  }
}
