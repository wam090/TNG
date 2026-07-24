import type { ElementId, Tag } from './ElementModule';
import type { PlayerStats } from '../player/PlayerStats';

/**
 * SPEC §2.5 — the fusion table. THE TYPE EXISTS AT M3; THE CONTENT DOES NOT.
 *
 * ██  DO NOT FILL THIS IN until Wind, Fire, Water AND Earth have ALL      ██
 * ██  shipped end-to-end. This table is the single most seductive scope   ██
 * ██  trap in the design (SPEC §2.5, CLAUDE.md anti-goals).               ██
 */
export interface FusedElement {
  id: string;
  displayName: string;
  components: [ElementId, ElementId];
  tags: Tag[];
  statMods: Partial<PlayerStats>;
}

export const FUSION: Record<string, FusedElement> = {};
