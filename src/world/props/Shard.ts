import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import { GIZMO_COLOR, wireSphere } from '../PropGizmos';
import type { ShardData } from '../PropSchema';
import { clamp } from '../../core/Math';
import type { Prop, PropContext } from './Prop';

/**
 * SPEC §6.4 Shard: an optional collectible. On player overlap it despawns and
 * reports its id (saving to the profile is M6's Save system — not built here).
 */
export class Shard implements Prop {
  readonly id: string;
  readonly gizmo: THREE.LineSegments;
  private readonly mesh: THREE.Mesh;
  private readonly centre: THREE.Vector3;
  private collected = false;

  constructor(
    private readonly data: ShardData,
    private readonly scene: THREE.Scene,
  ) {
    this.id = data.id;
    const S = TUNING.props.shard;
    this.mesh = new THREE.Mesh(
      new THREE.TetrahedronGeometry(S.visualRadius),
      new THREE.MeshStandardMaterial({ color: S.color, emissive: S.color, emissiveIntensity: S.glow, roughness: 0.5, metalness: 0 }),
    );
    this.centre = new THREE.Vector3(...data.pos);
    this.mesh.position.copy(this.centre);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.gizmo = wireSphere(S.radius, GIZMO_COLOR.idle);
    this.gizmo.position.copy(this.centre);
  }

  update(dt: number, ctx: PropContext): void {
    if (this.collected) return;
    const S = TUNING.props.shard;
    this.mesh.rotation.y += S.spinRate * dt;
    // Distance from the shard to the capsule's vertical axis segment (feet → head).
    const f = ctx.player.feet;
    const nearest = new THREE.Vector3(f.x, clamp(this.centre.y, f.y, f.y + TUNING.player.height), f.z);
    if (nearest.distanceTo(this.centre) > S.radius) return;
    this.collected = true;
    this.scene.remove(this.mesh);
    this.gizmo.visible = false;
    ctx.collectShard(this.data.id);
  }

  get isCollected(): boolean {
    return this.collected;
  }

  pushBounds(): null {
    return null;
  }

  onPush(): void {
    // Collectibles are collected, not pushed.
  }

  solid(): null {
    return null;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
