import { TUNING } from '../config/tuning';

export interface InputSnapshot {
  /** Normalised, length <= 1. +x = right-screen, +y = down-screen (gamepad stick convention). */
  move: { x: number; y: number };
  jumpPressed: boolean;
  jumpHeld: boolean;
  jumpReleased: boolean;
  actionPressed: boolean;
  actionHeld: boolean;
  actionReleased: boolean;
}

/** Anything the sim can poll for input — real devices (Input) or a script (ScriptedInput). */
export interface InputSource {
  poll(): InputSnapshot;
}

// Bindings are mappings, not tunables — they live here, named, not in tuning.ts.
const KEYS_UP = ['KeyW', 'ArrowUp'] as const;
const KEYS_DOWN = ['KeyS', 'ArrowDown'] as const;
const KEYS_LEFT = ['KeyA', 'ArrowLeft'] as const;
const KEYS_RIGHT = ['KeyD', 'ArrowRight'] as const;
const KEYS_JUMP = ['Space'] as const;
const KEYS_ACTION = ['KeyE'] as const;
const PAD_JUMP_BUTTON = 0; // A / Cross
const PAD_ACTION_BUTTON = 2; // X / Square
const GAME_KEYS: ReadonlySet<string> = new Set([
  ...KEYS_UP,
  ...KEYS_DOWN,
  ...KEYS_LEFT,
  ...KEYS_RIGHT,
  ...KEYS_JUMP,
  ...KEYS_ACTION,
]);

/**
 * Poll-based input. Listeners only record raw device state; the game polls a
 * snapshot each fixed step, so pressed/released edges land exactly on substep
 * boundaries and are consumed once.
 */
export class Input implements InputSource {
  private readonly down = new Set<string>();
  private prevJumpHeld = false;
  private prevActionHeld = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault(); // Space scrolls, arrows pan
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear(); // keyups lost while unfocused would stick forever
    });
  }

  /** Poll current device state. Edges are relative to the previous poll. */
  poll(): InputSnapshot {
    let x = (this.anyDown(KEYS_RIGHT) ? 1 : 0) - (this.anyDown(KEYS_LEFT) ? 1 : 0);
    let y = (this.anyDown(KEYS_DOWN) ? 1 : 0) - (this.anyDown(KEYS_UP) ? 1 : 0);
    let jumpHeld = this.anyDown(KEYS_JUMP);
    let actionHeld = this.anyDown(KEYS_ACTION);

    const pad = this.firstGamepad();
    if (pad) {
      const [px, py] = this.stickWithDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      x += px;
      y += py;
      jumpHeld ||= pad.buttons[PAD_JUMP_BUTTON]?.pressed ?? false;
      actionHeld ||= pad.buttons[PAD_ACTION_BUTTON]?.pressed ?? false;
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    const snapshot: InputSnapshot = {
      move: { x, y },
      jumpPressed: jumpHeld && !this.prevJumpHeld,
      jumpHeld,
      jumpReleased: !jumpHeld && this.prevJumpHeld,
      actionPressed: actionHeld && !this.prevActionHeld,
      actionHeld,
      actionReleased: !actionHeld && this.prevActionHeld,
    };
    this.prevJumpHeld = jumpHeld;
    this.prevActionHeld = actionHeld;
    return snapshot;
  }

  private anyDown(codes: readonly string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  private firstGamepad(): Gamepad | null {
    for (const pad of navigator.getGamepads()) {
      if (pad?.connected) return pad;
    }
    return null;
  }

  /** Radial deadzone with rescaling so output ramps smoothly from the deadzone edge. */
  private stickWithDeadzone(rawX: number, rawY: number): [number, number] {
    const dz = TUNING.input.gamepadDeadzone;
    const mag = Math.hypot(rawX, rawY);
    if (mag <= dz) return [0, 0];
    const scale = Math.min((mag - dz) / (1 - dz), 1) / mag;
    return [rawX * scale, rawY * scale];
  }
}
