import type * as THREE from 'three';
import type { PlayerState } from '../player/PlayerStateMachine';
import type { PlayerStats } from '../player/PlayerStats';
import type { SocketId } from '../player/Sockets';

// The single source for element ids — validators and wiring use this array,
// so element name literals never appear outside elements/ modules and data.
export const ELEMENT_IDS = ['wind', 'fire', 'water', 'earth'] as const;
export type ElementId = (typeof ELEMENT_IDS)[number];

export function isElementId(value: string): value is ElementId {
  return (ELEMENT_IDS as readonly string[]).includes(value);
}

export type Tag = 'light' | 'heavy' | 'air' | 'burning' | 'wet' | 'earthen';

/** What attachments/vfx may read about the player each step. No identity, no mutation. */
export interface PlayerRuntimeState {
  state: PlayerState;
  grounded: boolean;
  horizontalSpeed: number;
  verticalVelocity: number;
}

export interface AttachmentContext {
  socket: THREE.Object3D;
}

/** SPEC §3.2 — a mesh bolted onto a named socket. */
export interface AttachmentSpec {
  socket: SocketId;
  build: (ctx: AttachmentContext) => THREE.Object3D;
  animate?: (obj: THREE.Object3D, dt: number, s: PlayerRuntimeState) => void;
}

export interface ElementVfx {
  update(dt: number, s: PlayerRuntimeState): void;
  dispose(): void;
}

/** Shape only at M3 — abilities are implemented at M4 (Ability interface, SPEC §8.6). */
export interface AbilitySpec {
  id: string;
  cooldown: number;
}

/** SPEC §8.6. statMods are ABSOLUTE OVERRIDES, not multipliers (DM ruling, see DECISIONS.md). */
export interface ElementModule {
  id: ElementId;
  displayName: string;
  bodyTint: string;
  tags: Tag[];
  statMods: Partial<PlayerStats>;
  attachments: AttachmentSpec[];
  abilities: AbilitySpec[];
  vfx: () => ElementVfx;
}
