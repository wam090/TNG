import type { AbilitySpec } from '../elements/ElementModule';
import type { PlayerState } from '../player/PlayerStateMachine';
import type { PlayerStats } from '../player/PlayerStats';
import type { Ability, AbilityContext, AbilityWorld } from './Ability';

interface Slot {
  ability: Ability;
  cooldownLeft: number;
  active: boolean;
}

/**
 * Element-blind ability lifecycle: canUse → start → update… → end, plus
 * cooldowns. It iterates whatever specs the loadout hands it and never names
 * an element (lint-enforced). Cooldowns and updates run on world dt, so
 * dilation slows them and hit-stop pauses them, like everything else.
 */
export class AbilityRunner {
  private slots: Slot[] = [];
  private lastContext: AbilityContext | null = null;

  /** Replace the ability set (loadout changed). Active abilities end first. */
  setAbilities(specs: readonly AbilitySpec[]): void {
    this.endAll();
    this.slots = specs.map((spec) => ({ ability: spec.create(), cooldownLeft: 0, active: false }));
  }

  /** One fixed step. Call BEFORE the controller so impulses/overrides land this step. */
  update(dt: number, s: AbilityContext, w: AbilityWorld): void {
    this.lastContext = s;
    for (const slot of this.slots) {
      slot.cooldownLeft = Math.max(0, slot.cooldownLeft - dt);
      if (slot.active) {
        if (!slot.ability.update(dt, s, w)) {
          slot.ability.end(s);
          slot.active = false;
        }
      } else if (slot.cooldownLeft <= 0 && slot.ability.canUse(s)) {
        slot.ability.start(s, w);
        slot.active = true;
        slot.cooldownLeft = slot.ability.cooldown;
      }
    }
  }

  /** Merged overrides of every active ability, in loadout order (later wins). */
  statOverrides(s: AbilityContext): Partial<PlayerStats> {
    const merged: Partial<PlayerStats> = {};
    for (const slot of this.slots) {
      if (slot.active && slot.ability.statOverrides) Object.assign(merged, slot.ability.statOverrides(s));
    }
    return merged;
  }

  /** The state of the first active ability that reports one, else null. */
  get activeState(): PlayerState | null {
    for (const slot of this.slots) {
      if (slot.active && slot.ability.state) return slot.ability.state;
    }
    return null;
  }

  isActive(id: string): boolean {
    return this.slots.some((slot) => slot.active && slot.ability.id === id);
  }

  cooldownLeft(id: string): number {
    return this.slots.find((slot) => slot.ability.id === id)?.cooldownLeft ?? 0;
  }

  private endAll(): void {
    for (const slot of this.slots) {
      if (slot.active && this.lastContext) slot.ability.end(this.lastContext);
      slot.active = false;
    }
  }
}
