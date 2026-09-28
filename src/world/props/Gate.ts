import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import { clamp, DEG2RAD } from '../../core/Math';
import type { Materials } from '../../render/Materials';
import { GIZMO_COLOR, setGizmoColor, wireBox } from '../PropGizmos';
import type { GateData } from '../PropSchema';
import { solidBox, type Prop, type PropContext } from './Prop';

/**
 * SPEC §6.4 Gate. Listens to signal id(s); when satisfied (requireAll by
 * default) it grinds open by sinking into the ground over gate.openTime.
 * Solid until fully open. Not pushable — only signals move it.
 */
export class Gate implements Prop {
  readonly id: string;
  readonly gizmo: THREE.LineSegments;
  private readonly slab: THREE.Mesh;
  private readonly slabSolid: THREE.BufferGeometry;
  private progress = 0; // 0 closed → 1 open
  private opening = false;

  constructor(
    private readonly data: GateData,
    private readonly scene: THREE.Scene,
    materials: Materials,
  ) {
    this.id = data.id;
    const [w, h, d] = data.size;
    this.slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.get('metal'));
    this.slab.position.set(data.pos[0], data.pos[1] + h / 2, data.pos[2]);
    this.slab.rotation.y = data.rotY * DEG2RAD;
    this.slab.castShadow = true;
    this.slab.receiveShadow = true;
    scene.add(this.slab);

    const frame = new THREE.Matrix4()
      .makeRotationY(data.rotY * DEG2RAD)
      .setPosition(data.pos[0], data.pos[1], data.pos[2]);
    this.slabSolid = solidBox(data.size, [0, h / 2, 0], frame);

    this.gizmo = wireBox(data.size, GIZMO_COLOR.idle);
    this.gizmo.position.set(...data.pos);
    this.gizmo.rotation.y = data.rotY * DEG2RAD;
  }

  update(dt: number, ctx: PropContext): void {
    if (!this.opening && ctx.signals.satisfied(this.data.listensTo, this.data.requireAll)) this.opening = true;
    if (this.opening && this.progress < 1) {
      this.progress = clamp(this.progress + dt / TUNING.props.gate.openTime, 0, 1);
      const h = this.data.size[1];
      this.slab.position.y = this.data.pos[1] + h / 2 - this.progress * h;
    }
    setGizmoColor(this.gizmo, this.isOpen ? GIZMO_COLOR.done : this.opening ? GIZMO_COLOR.active : GIZMO_COLOR.idle);
  }

  pushBounds(): null {
    return null;
  }

  onPush(): void {
    // Gates answer to signals, not pushes.
  }

  solid(): THREE.BufferGeometry | null {
    return this.isOpen ? null : this.slabSolid;
  }

  get isOpen(): boolean {
    return this.progress >= 1;
  }

  dispose(): void {
    this.slabSolid.dispose();
    this.scene.remove(this.slab);
    this.slab.geometry.dispose();
  }
}
