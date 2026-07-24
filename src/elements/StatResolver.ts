import type { PlayerStats } from '../player/PlayerStats';
import type { ElementModule } from './ElementModule';

/**
 * Resolve the effective stats from base + loadout. PURE: never mutates its
 * inputs, no side effects, deterministic (SPEC §8.6 contract).
 *
 * Semantics (DM ruling): statMods are ABSOLUTE OVERRIDES applied in loadout
 * order — the LAST element to override a key wins. They are not multipliers:
 * Wind's fallGravityMult 1.15 must REPLACE base 1.6 (slower fall); as a
 * multiplier it would yield 1.84 — faster fall, the opposite of Wind.
 */
export function resolveStats(base: PlayerStats, loadout: readonly ElementModule[]): PlayerStats {
  const resolved: PlayerStats = { ...base };
  for (const module of loadout) {
    Object.assign(resolved, module.statMods);
  }
  return resolved;
}
