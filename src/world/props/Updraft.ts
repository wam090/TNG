import * as THREE from 'three';
import type { Materials } from '../../render/Materials';
import { GIZMO_COLOR, setGizmoColor, wireBox } from '../PropGizmos';
import type { UpdraftData } from '../PropSchema';
import { bodyCentre, type Prop, type PropContext } from './Prop';
import { Volume } from './Volume';

// Structural visuals: a floor grate, and a faint column so the VP can see the
// lift while playtesting (the real VFX is M5).
const GRATE_THICKNESS = 0.06;
const COLUMN_OPACITY = 0.1;
const COLUMN_COLOR = '#FFFFFF';

/**
 * SPEC §6.4 Updraft, mass-sensitive per DM ruling (WO-003): while enabled and
 * the body is inside the column, it applies an upward FORCE through the mass
 * path — it never learns the mass. force/mass beats gravity for a light body
 * and loses for the base body. It stops pushing once the body rises at
 * `velocity` (SPEC's 9 m/s, now a ceiling) and above the column top.
 * Enabled by its listensTo signal(s); always on if it listens to nothing.
 */
export class Updraft implements Prop {
  readonly id: string;
  readonly gizmo: THREE.LineSegments;
  private readonly volume: Volume;
  private readonly grate: THREE.Mesh;
  private readonly column: THREE.Mesh;
  private enabled: boolean;
  private lifting = false;
  private readonly lift = new THREE.Vector3();

  constructor(
    private readonly data: UpdraftData,
    private readonly scene: THREE.Scene,
    materials: Materials,
  ) {
    this.id = data.id;
    this.volume = new Volume(data.pos, data.size);
    this.enabled = data.listensTo.length === 0;
    this.lift.set(0, data.force, 0);
    const [w, h, d] = data.size;

    this.grate = new THREE.Mesh(new THREE.BoxGeometry(w, GRATE_THICKNESS, d), materials.get('metal'));
    this.grate.position.set(data.pos[0], data.pos[1] + GRATE_THICKNESS / 2, data.pos[2]);
    this.grate.receiveShadow = true;
    this.column = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color: COLUMN_COLOR, transparent: true, opacity: COLUMN_OPACITY, depthWrite: false }),
    );
    this.column.position.set(data.pos[0], data.pos[1] + h / 2, data.pos[2]);
    this.column.visible = this.enabled;
    scene.add(this.grate, this.column);

    this.gizmo = wireBox(data.size, GIZMO_COLOR.idle);
    this.gizmo.position.set(...data.pos);
  }

  update(_dt: number, ctx: PropContext): void {
    if (!this.enabled && ctx.signals.satisfied(this.data.listensTo, this.data.requireAll)) {
      this.enabled = true;
      this.column.visible = true;
    }
    const inside = this.volume.contains(bodyCentre(ctx.player));
    const lifting = this.enabled && inside && ctx.player.velocity.y < this.data.velocity;
    if (lifting) ctx.player.applyForce(this.lift);
    if (lifting && !this.lifting) ctx.reportLift(this.data.id); // each time a lift begins
    this.lifting = lifting;
    setGizmoColor(this.gizmo, !this.enabled ? GIZMO_COLOR.idle : inside ? GIZMO_COLOR.active : GIZMO_COLOR.done);
  }

  pushBounds(): null {
    return null;
  }

  onPush(): void {
    // A column of air does not care about being pushed.
  }

  solid(): null {
    return null;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    this.scene.remove(this.grate, this.column);
    this.grate.geometry.dispose();
    this.column.geometry.dispose();
    (this.column.material as THREE.Material).dispose();
  }
}
