import * as THREE from 'three';
import type { PushEvent } from '../../core/Events';
import type { Materials } from '../../render/Materials';
import { GIZMO_COLOR, setGizmoColor, wireBox } from '../PropGizmos';
import type { DebrisData } from '../PropSchema';
import type { PushBounds } from '../PushCone';
import type { Vec3Tuple } from '../SchemaUtil';
import { solidBox, type Prop, type PropContext } from './Prop';

// Structural: a low pile of three rubble blocks over a vent (visual + collision).
const PILE_SIZE: Vec3Tuple = [1.6, 0.7, 1.6];
const RUBBLE: readonly { size: Vec3Tuple; at: Vec3Tuple; rotY: number }[] = [
  { size: [0.9, 0.5, 0.8], at: [-0.3, 0.25, -0.2], rotY: 0.3 },
  { size: [0.7, 0.7, 0.7], at: [0.35, 0.35, 0.25], rotY: -0.5 },
  { size: [0.6, 0.35, 0.9], at: [0.1, 0.18, -0.45], rotY: 1.1 },
];

/**
 * SPEC §6.4 Debris. A push stronger than `threshold` destroys it: it
 * despawns (the "puff" is M5 VFX) and emits its signal. Solid until then.
 */
export class Debris implements Prop {
  readonly id: string;
  readonly gizmo: THREE.LineSegments;
  private readonly group = new THREE.Group();
  private readonly pileSolid: THREE.BufferGeometry;
  private destroyed = false;

  constructor(
    private readonly data: DebrisData,
    private readonly scene: THREE.Scene,
    materials: Materials,
  ) {
    this.id = data.id;
    for (const r of RUBBLE) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(...r.size), materials.get('pillar'));
      block.position.set(...r.at);
      block.rotation.y = r.rotY;
      block.castShadow = true;
      this.group.add(block);
    }
    this.group.position.set(...data.pos);
    scene.add(this.group);
    this.pileSolid = solidBox(PILE_SIZE, [0, PILE_SIZE[1] / 2, 0], new THREE.Matrix4().makeTranslation(...data.pos));
    this.gizmo = wireBox(PILE_SIZE, GIZMO_COLOR.idle);
    this.gizmo.position.set(...data.pos);
  }

  update(): void {
    // Inert until pushed.
  }

  pushBounds(): PushBounds | null {
    if (this.destroyed) return null;
    const [w, h, d] = PILE_SIZE;
    return {
      box: new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2)),
      frame: new THREE.Matrix4().makeTranslation(...this.data.pos),
    };
  }

  onPush(e: PushEvent, ctx: PropContext): void {
    if (this.destroyed || e.force <= this.data.threshold) return;
    this.destroyed = true;
    this.scene.remove(this.group);
    setGizmoColor(this.gizmo, GIZMO_COLOR.done);
    if (this.data.emits) ctx.signals.emit(this.data.emits);
  }

  solid(): THREE.BufferGeometry | null {
    return this.destroyed ? null : this.pileSolid;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  dispose(): void {
    this.pileSolid.dispose();
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
    });
  }
}
