import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TUNING } from '../config/tuning';
import { DEG2RAD } from '../core/Math';
import type { Materials } from '../render/Materials';
import { Collider } from './Collider';
import type { LevelBlock, LevelData } from './LevelSchema';

const LIGHT_COLOR = 0xffffff; // untinted lights; the palette carries all colour

// Fence = a camera-side boundary (WO-004 D1): a WAIST-HIGH railing you can see over,
// whose collision rises to the block's full height — an invisible barrier above the
// rail. Tall see-through bars were tried first and caged the bottom of every frame.
// Structural geometry (like chassis proportions); posts run along the block's local X.
const FENCE_RAIL_HEIGHT = 1.1;
const FENCE_POST = 0.12;
const FENCE_SPACING = 1.1;
const FENCE_RAIL = 0.1;

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

/** A waist-high railing at the BOTTOM of the block's box: posts along local X, two rails. */
function fenceGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const posts = Math.max(2, Math.round(w / FENCE_SPACING) + 1);
  const post = Math.min(FENCE_POST, d);
  const rail = Math.min(FENCE_RAIL_HEIGHT, h);
  const base = -h / 2; // bottom of the block's box
  for (let i = 0; i < posts; i += 1) {
    const g = new THREE.BoxGeometry(post, rail, post);
    g.translate(-w / 2 + post / 2 + ((w - post) * i) / (posts - 1), base + rail / 2, 0);
    parts.push(g);
  }
  for (const y of [base + rail - FENCE_RAIL / 2, base + rail / 2]) {
    const rail = new THREE.BoxGeometry(w, FENCE_RAIL, post);
    rail.translate(0, y, 0);
    parts.push(rail);
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

function blockGeometry(block: LevelBlock): THREE.BufferGeometry {
  const [w, h, d] = block.size;
  if (block.type === 'fence') return fenceGeometry(w, h, d);
  return block.type === 'box' ? new THREE.BoxGeometry(w, h, d) : wedgeGeometry(w, h, d);
}

/** What the capsule collides with: a fence is solid across its whole box. */
function collisionGeometry(block: LevelBlock, visual: THREE.BufferGeometry): THREE.BufferGeometry {
  return block.type === 'fence' ? new THREE.BoxGeometry(...block.size) : visual;
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.updateMatrix();
      group.add(mesh);

      // Collision copy: world-space positions only, no normals/uvs needed.
      const source = collisionGeometry(block, geometry);
      const part = new THREE.BufferGeometry();
      part.setAttribute('position', source.getAttribute('position').clone());
      if (source.index) part.setIndex(source.index.clone());
      if (source !== geometry) source.dispose();
      part.applyMatrix4(mesh.matrix);
      if (part.index) {
        collisionParts.push(part.toNonIndexed());
        part.dispose();
      } else {
        collisionParts.push(part);
      }
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
    this.fitSunShadow(sun, group);
    group.add(sun);
    group.add(sun.target);
    group.add(new THREE.AmbientLight(LIGHT_COLOR, env.ambient));
  }

  /** Shadow camera auto-fits the level bounds — no hand-tuned frustum numbers. */
  private fitSunShadow(sun: THREE.DirectionalLight, group: THREE.Group): void {
    const bounds = new THREE.Box3().setFromObject(group);
    const centre = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;

    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(TUNING.render.shadow.mapSize);
    sun.shadow.bias = TUNING.render.shadow.bias;
    sun.position.normalize().multiplyScalar(radius * 2).add(centre);
    sun.target.position.copy(centre);
    const cam = sun.shadow.camera;
    cam.left = -radius;
    cam.right = radius;
    cam.top = radius;
    cam.bottom = -radius;
    cam.near = radius * 0.1;
    cam.far = radius * 4;
  }
}
