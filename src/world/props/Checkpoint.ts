import * as THREE from 'three';
import type { Materials } from '../../render/Materials';
import { GIZMO_COLOR, setGizmoColor, wireSphere } from '../PropGizmos';
import type { CheckpointData } from '../PropSchema';
import type { Prop, PropContext } from './Prop';

// Structural: a low pad marking the respawn point.
const PAD_RADIUS = 0.6;
const PAD_HEIGHT = 0.06;
const PAD_SEGMENTS = 24;

/**
 * SPEC §6.4 Checkpoint. On player overlap it becomes the respawn point
 * (SPEC §6.3). Latched: each checkpoint fires once, so walking back past an
 * old one never rewinds progress. `pos` is the respawn FEET position.
 */
export class Checkpoint implements Prop {
  readonly id: string;
  readonly gizmo: THREE.LineSegments;
  private readonly pad: THREE.Mesh;
  private readonly centre: THREE.Vector3;
  private reached = false;

  constructor(
    private readonly data: CheckpointData,
    private readonly scene: THREE.Scene,
    private readonly materials: Materials,
  ) {
    this.id = data.id;
    this.pad = new THREE.Mesh(new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS, PAD_HEIGHT, PAD_SEGMENTS), materials.get('metal'));
    this.pad.position.set(data.pos[0], data.pos[1] + PAD_HEIGHT / 2, data.pos[2]);
    this.pad.receiveShadow = true;
    scene.add(this.pad);
    this.centre = new THREE.Vector3(...data.pos);
    this.gizmo = wireSphere(data.radius, GIZMO_COLOR.idle);
    this.gizmo.position.copy(this.centre);
  }

  update(_dt: number, ctx: PropContext): void {
    if (this.reached) return;
    if (ctx.player.feet.distanceTo(this.centre) > this.data.radius) return;
    this.reached = true;
    this.pad.material = this.materials.get('pillar');
    setGizmoColor(this.gizmo, GIZMO_COLOR.done);
    ctx.setCheckpoint(this.data.id, this.centre.clone());
  }

  /** The respawn point this checkpoint sets (F5 teleports here). */
  get respawn(): THREE.Vector3 {
    return this.centre.clone();
  }

  get isReached(): boolean {
    return this.reached;
  }

  pushTarget(): null {
    return null;
  }

  onPush(): void {
    // Checkpoints only care about being stood on.
  }

  solid(): null {
    return null;
  }

  dispose(): void {
    this.scene.remove(this.pad);
    this.pad.geometry.dispose();
  }
}
