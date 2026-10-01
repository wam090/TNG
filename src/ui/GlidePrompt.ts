/** The keycap the glide prompt drives (an ActionPrompt showing the JUMP glyph). */
export interface GlideKeycap {
  show(): void;
  dismiss(): void;
  reset(): void;
}

/** What the prompt reads from the player each step: state, never identity. */
export interface GlideCue {
  /** Airborne and moving up. */
  rising: boolean;
  /** Airborne and moving down. */
  falling: boolean;
  /** In the glide state. */
  gliding: boolean;
}

/**
 * WO-006 Stage A: when to show the glide prompt. Armed by the first updraft
 * lift (a bus event); shows the Jump keycap from the first falling step after
 * the lift has actually carried him UP (he can drop into a column, and the
 * lift starts while he is still falling — that is not yet "after the lift"),
 * until the first glide. Once per run — a glide before any lift counts too
 * (he already knows). DOM-free so the rule is unit-tested; a replay resets it
 * through LevelRun.
 */
export class GlidePrompt {
  private armed = false;
  private rose = false;
  private done = false;

  constructor(private readonly keycap: GlideKeycap) {}

  /** An updraft started lifting him. */
  lifted(): void {
    if (!this.done) this.armed = true;
  }

  /** Once per fixed step, after the player has moved. */
  step(cue: GlideCue): void {
    if (this.done) return;
    if (cue.gliding) {
      this.done = true;
      this.keycap.dismiss();
      return;
    }
    if (this.armed && cue.rising) this.rose = true;
    if (this.rose && cue.falling) this.keycap.show();
  }

  /** Replay: unarmed, hidden, ready to teach again. */
  reset(): void {
    this.armed = false;
    this.rose = false;
    this.done = false;
    this.keycap.reset();
  }

  get isDone(): boolean {
    return this.done;
  }
}
