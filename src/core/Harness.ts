import type { Game, GameSnapshot } from './Game';
import { parseInputScript, ScriptedInput } from './ScriptedInput';

/**
 * Deterministic test/screenshot harness, exposed as window.__stillmote in dev
 * builds only (main.ts gates on import.meta.env.DEV + ?harness=1). Drives the
 * sim by exact fixed steps — no rAF, no wall clock, no accumulator — so a
 * harness run renders identically on any machine at any speed.
 */
export interface StillmoteHarness {
  /** Advance exactly n fixed sim steps, then render once. step(0) renders the initial state. */
  step(n: number): void;
  /** Reseed the game RNG. */
  seed(s: number): void;
  /** Install a scripted input timeline (parsed scripts/*.json content). */
  input(script: unknown): void;
  /** JSON-serialisable snapshot of sim state, for assertions and debugging. */
  state(): GameSnapshot;
}

declare global {
  interface Window {
    __stillmote?: StillmoteHarness;
  }
}

export function installHarness(game: Game): void {
  window.__stillmote = {
    step: (n: number): void => {
      game.stepManual(n);
    },
    seed: (s: number): void => {
      game.reseed(s);
    },
    input: (script: unknown): void => {
      game.setInputSource(new ScriptedInput(parseInputScript(script)));
    },
    state: (): GameSnapshot => game.snapshot(),
  };
}
