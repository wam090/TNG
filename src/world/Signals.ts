/**
 * Named, LATCHED signals (SPEC §6.4 signal/gate wiring). Once emitted, a
 * signal stays on until the level reloads — a windmill that turned the shaft
 * has opened the gate for good. Listeners poll each step (deterministic, no
 * callback ordering to reason about).
 */
export class Signals {
  private readonly on = new Set<string>();

  emit(id: string): void {
    this.on.add(id);
  }

  isOn(id: string): boolean {
    return this.on.has(id);
  }

  /** requireAll=true → every id must be on; false → any one. Empty list is never satisfied. */
  satisfied(ids: readonly string[], requireAll: boolean): boolean {
    if (ids.length === 0) return false;
    return requireAll ? ids.every((id) => this.on.has(id)) : ids.some((id) => this.on.has(id));
  }

  reset(): void {
    this.on.clear();
  }

  /** Every signal that is on, sorted (harness state, F1). */
  list(): string[] {
    return [...this.on].sort();
  }
}
