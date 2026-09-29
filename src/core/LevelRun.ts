import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { Level } from '../world/Level';

/** Anything holding run state that a replay must put back the way a fresh load left it. */
export interface Resettable {
  reset(): void;
}

/**
 * One play-through of a level. start() is BOTH the first load and every
 * replay — one code path, so a replay cannot drift from a fresh load
 * (WO-005): rebuild the level from its JSON (props, signals, tokens, shards,
 * Goal), put a plain body at spawn, then reset every other holder of run
 * state it was given (time scale, timer and card, HUD, prompt, camera…).
 */
export class LevelRun {
  constructor(
    private readonly level: Level,
    private readonly player: Player,
    private source: unknown,
    private readonly parts: readonly Resettable[],
  ) {}

  start(): void {
    this.level.load(this.source);
    this.player.reset(this.spawnFeet());
    for (const part of this.parts) part.reset();
  }

  /** Level JSON hot reload: the next replay rebuilds from this. */
  setSource(raw: unknown): void {
    this.source = raw;
  }

  /** The JSON spawn point dropped onto the ground below it. */
  spawnFeet(): THREE.Vector3 {
    const spawn = this.level.spawn ?? new THREE.Vector3();
    const hit = this.level.collider?.groundProbe(spawn);
    return hit ? new THREE.Vector3(spawn.x, hit.point.y, spawn.z) : spawn.clone();
  }
}
