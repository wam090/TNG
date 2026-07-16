import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEG2RAD } from '../core/Math';
import type { Materials } from '../render/Materials';
import { Collider } from './Collider';
import type { LevelBlock, LevelData } from './LevelSchema';

const LIGHT_COLOR = 0xffffff; // untinted lights; the palette carries all colour

export interface BuiltLevel {
  group: THREE.Group;
  collider: Collider;
  spawn: THREE.Vector3;
  dispose(): void;
}

/**
 * Ramp = wedge. Convention (documented for JSON authoring): the bounding box
 * is centred on `pos` like a box; the slope rises along local +Z, from the
 * bottom at -Z to full height at +Z. Use rotY (degrees, CCW around Y) to face it.
 */
function wedgeGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  // prettier-ignore
  const positions = new Float32Array([
    // bottom (-y)
    -x, -y, -z,   x, -y, -z,   x, -y,  z,
    -x, -y, -z,   x, -y,  z,  -x, -y,  z,
    // back (+z, full height)
    -x, -y,  z,   x, -y,  z,   x,  y,  z,
    -x, -y,  z,   x,  y,  z,  -x,  y,  z,
    // slope (from -z bottom edge to +z top edge)
    -x, -y, -z,   x,  y,  z,   x, -y, -z,
    -x, -y, -z,  -x,  y,  z,   x,  y,  z,
    // left (-x) triangle
    -x, -y, -z,  -x, -y,  z,  -x,  y,  z,
    // right (+x) triangle
     x, -y, -z,   x,  y,  z,   x, -y,  z,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function blockGeometry(block: LevelBlock): THREE.BufferGeometry {
  const [w, h, d] = block.size;
  return block.type === 'box' ? new THREE.BoxGeometry(w, h, d) : wedgeGeometry(w, h, d);
}

/** Turns validated LevelData into meshes + environment + one merged static collider. */
export class LevelBuilder {
  constructor(private readonly materials: Materials) {}

  build(data: LevelData, scene: THREE.Scene): BuiltLevel {
    const group = new THREE.Group();
    group.name = data.id;
    const collisionParts: THREE.BufferGeometry[] = [];

    for (const block of data.blocks) {
      const geometry = blockGeometry(block);
      const mesh = new THREE.Mesh(geometry, this.materials.get(block.mat));
      mesh.position.set(...block.pos);
      mesh.rotation.y = block.rotY * DEG2RAD;
      mesh.updateMatrix();
      group.add(mesh);

      // Collision copy: world-space positions only, no normals/uvs needed.
      const part = new THREE.BufferGeometry();
      part.setAttribute('position', geometry.getAttribute('position').clone());
      if (geometry.index) part.setIndex(geometry.index.clone());
      part.applyMatrix4(mesh.matrix);
      collisionParts.push(part.toNonIndexed());
      part.dispose();
    }

    const merged = mergeGeometries(collisionParts, false);
    for (const part of collisionParts) part.dispose();

    this.applyEnv(data, scene, group);
    scene.add(group);

    const collider = new Collider(merged);
    return {
      group,
      collider,
      spawn: new THREE.Vector3(...data.spawn),
      dispose: (): void => {
        scene.remove(group);
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) (obj.geometry as THREE.BufferGeometry).dispose();
        });
        collider.dispose();
        scene.fog = null;
      },
    };
  }

  private applyEnv(data: LevelData, scene: THREE.Scene, group: THREE.Group): void {
    const env = data.env;
    scene.background = new THREE.Color(env.sky);
    scene.fog = env.fog ? new THREE.Fog(env.fog.color, env.fog.near, env.fog.far) : null;

    // Lights live in the group so a rebuild replaces them with the level.
    const sun = new THREE.DirectionalLight(LIGHT_COLOR, env.sunIntensity);
    sun.position.set(-env.sunDir[0], -env.sunDir[1], -env.sunDir[2]);
    group.add(sun);
    group.add(new THREE.AmbientLight(LIGHT_COLOR, env.ambient));
  }
}
