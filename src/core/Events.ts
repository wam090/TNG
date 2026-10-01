import type * as THREE from 'three';
import type { ElementId, Tag } from '../elements/ElementModule';

// SPEC §2.3 — the four verb events. Props react to these and to quantities
// (force, heat, volume, mass). `tags` rides along for non-prop consumers;
// props may not read it (lint-enforced in src/world/props/**, WO-003).
export interface PushEvent {
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  force: number;
  tags: readonly Tag[];
}
export interface IgniteEvent {
  origin: THREE.Vector3;
  heat: number;
  tags: readonly Tag[];
} // fire, later
export interface SoakEvent {
  origin: THREE.Vector3;
  volume: number;
  tags: readonly Tag[];
} // water, later
export interface ImpactEvent {
  origin: THREE.Vector3;
  mass: number;
  tags: readonly Tag[];
} // earth, later

/** All game events, typed. */
export interface GameEvents {
  tokenPickup: { element: ElementId; tokenId: string };
  checkpoint: { id: string; feet: THREE.Vector3 };
  shardCollected: { id: string };
  levelComplete: { levelId: string };
  /** An updraft started lifting the body (WO-006: arms the glide prompt). Says nothing about who. */
  updraftLift: { id: string };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

/** Tiny typed event bus (SPEC §8.1: plain classes + a tiny typed event bus). */
export class EventBus {
  private readonly handlers = new Map<keyof GameEvents, Set<(payload: unknown) => void>>();

  /** Subscribe; returns an unsubscribe function. */
  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const erased = handler as (payload: unknown) => void;
    set.add(erased);
    return () => set.delete(erased);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}
