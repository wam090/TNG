import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import { GIZMO_COLOR, setGizmoColor, wireBox } from '../PropGizmos';
import type { GoalData } from '../PropSchema';
import type { Prop, PropContext } from './Prop';

// Placeholder "pillar of light" (SPEC Beat 6) — M5/M7 own the real look.
const PILLAR_COLOR = '#FFFFFF';
const PILLAR_OPACITY = 0.35;
const PILLAR_SEGMENTS = 24;

/**
 * SPEC §6.4 Goal: walk into the pillar → the level is complete (reported
 * once; the Level Complete card is M6). Trigger: within `radius`
 * horizontally, feet between the pillar's base and top.
 */
export class Goal implements Prop {
  readonly id: string;
  readonly gizmo: THREE.LineSegments;
  private readonly pillar: THREE.Mesh;
  private reached = false;

  constructor(
    private readonly data: GoalData,
    private readonly scene: THREE.Scene,
  ) {
    this.id = data.id;
    const h = TUNING.props.goal.height;
    this.pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(data.radius, data.radius, h, PILLAR_SEGMENTS, 1, true),
      new THREE.MeshBasicMaterial({ color: PILLAR_COLOR, transparent: true, opacity: PILLAR_OPACITY, depthWrite: false }),
    );
    this.pillar.position.set(data.pos[0], data.pos[1] + h / 2, data.pos[2]);
    scene.add(this.pillar);
    this.gizmo = wireBox([data.radius * 2, h, data.radius * 2], GIZMO_COLOR.idle);
    this.gizmo.position.set(...data.pos);
  }

  update(_dt: number, ctx: PropContext): void {
    if (this.reached) return;
    const f = ctx.player.feet;
    const dx = f.x - this.data.pos[0];
    const dz = f.z - this.data.pos[2];
    const dy = f.y - this.data.pos[1];
    if (Math.hypot(dx, dz) > this.data.radius || dy < 0 || dy > TUNING.props.goal.height) return;
    this.reached = true;
    setGizmoColor(this.gizmo, GIZMO_COLOR.done);
    ctx.completeLevel();
  }

  get isReached(): boolean {
    return this.reached;
  }

  pushBounds(): null {
    return null;
  }

  onPush(): void {
    // The goal only cares about arrival.
  }

  solid(): null {
    return null;
  }

  dispose(): void {
    this.scene.remove(this.pillar);
    this.pillar.geometry.dispose();
    (this.pillar.material as THREE.Material).dispose();
  }
}
