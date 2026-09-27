import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import type { PushEvent } from '../../core/Events';
import type { Vec3Tuple } from '../SchemaUtil';
import type { Signals } from '../Signals';

/** All a prop may know about the player: where it is, and a way to push it. */
export interface PropPlayerView {
  readonly feet: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  /** The mass path — the prop never learns the mass; the controller divides by it. */
  applyForce(force: THREE.Vector3): void;
}

/** Overlap probe point: the capsule's mid-height, so ground-level volumes never flicker. */
export function bodyCentre(player: PropPlayerView): THREE.Vector3 {
  return player.feet.clone().setY(player.feet.y + TUNING.player.height / 2);
}

/** What props can reach each step. No element, no tag, no loadout — ever. */
export interface PropContext {
  player: PropPlayerView;
  signals: Signals;
  setCheckpoint(id: string, feet: THREE.Vector3): void;
  collectShard(id: string): void;
  completeLevel(): void;
}

/**
 * SPEC §6.4 prop contract. Props react to EVENTS (onPush), QUANTITIES
 * (force), SIGNALS and OVERLAP. They never react to element names or tags
 * (CLAUDE.md hard rule 5, lint-enforced in this folder).
 */
export interface Prop {
  readonly id: string;
  /** One fixed sim step on world (dilation-scaled) time. */
  update(dt: number, ctx: PropContext): void;
  /** World point a push cone must reach to hit this prop; null = not pushable. */
  pushTarget(): THREE.Vector3 | null;
  onPush(e: PushEvent, ctx: PropContext): void;
  /** World-space collision geometry while solid (e.g. a closed gate); null = not solid now. */
  solid(): THREE.BufferGeometry | null;
  /** F3 gizmo: volumes, thresholds, state. Created once, shown/hidden by Level. */
  readonly gizmo: THREE.Object3D;
  dispose(): void;
}

/**
 * A prop's collision box in WORLD space, in the collider's format (position
 * only, non-indexed) so Level can merge it with the static level geometry.
 * `center` is the box centre in the prop's local frame.
 */
export function solidBox(size: Vec3Tuple, center: Vec3Tuple, local: THREE.Matrix4): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(...size);
  box.translate(...center);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', box.getAttribute('position').clone());
  if (box.index) geometry.setIndex(box.index.clone());
  box.dispose();
  geometry.applyMatrix4(local);
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  return flat;
}
