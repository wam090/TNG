import type * as THREE from 'three';
import { TUNING } from '../config/tuning';

export interface DebugFrameStats {
  frameDt: number;
  steps: number;
  accumulator: number;
  substepCapHits: number;
  lastDroppedTime: number;
  drainedThisFrame: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  grounded: boolean;
  state: string;
}

const PANEL_CSS =
  'position:fixed;top:8px;left:8px;z-index:1000;padding:8px 10px;' +
  'background:rgba(10,12,14,0.78);color:#d7e0e7;border-radius:4px;' +
  'font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;' +
  'white-space:pre;pointer-events:none;';
const WARN_CSS = 'color:#ff5a52;font-weight:bold;';

/** F1 stats overlay. Receives everything from Game — never reads the wall clock. */
export class Debug {
  private readonly panel: HTMLDivElement;
  private readonly stats: HTMLDivElement;
  private readonly warn: HTMLDivElement;
  private readonly toggles = new Map<string, { on: boolean; apply: (on: boolean) => void }>();
  private visible = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 0;

  constructor() {
    this.panel = document.createElement('div');
    this.panel.style.cssText = PANEL_CSS;
    this.panel.style.display = 'none';
    this.stats = document.createElement('div');
    this.warn = document.createElement('div');
    this.warn.style.cssText = WARN_CSS;
    this.panel.append(this.stats, this.warn);
    document.body.appendChild(this.panel);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F1') {
        e.preventDefault(); // browsers open help on F1
        this.setVisible(!this.visible);
        return;
      }
      const toggle = this.toggles.get(e.code);
      if (toggle) {
        e.preventDefault();
        toggle.on = !toggle.on;
        toggle.apply(toggle.on);
      }
    });

    // ?debug=1 forces the overlay on from boot (screenshot harness --debug).
    if (new URLSearchParams(window.location.search).has('debug')) {
      this.setVisible(true);
    }
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.panel.style.display = visible ? 'block' : 'none';
  }

  /**
   * Register a keyed debug toggle (e.g. 'F2' → collider wireframe). The
   * current state survives re-registration, so hot-reloaded systems keep
   * their toggle state; `apply` is invoked immediately with that state.
   */
  registerToggle(code: string, apply: (on: boolean) => void): void {
    const on = this.toggles.get(code)?.on ?? false;
    this.toggles.set(code, { on, apply });
    apply(on);
  }

  isToggleOn(code: string): boolean {
    return this.toggles.get(code)?.on ?? false;
  }

  /** Called once per render frame by Game. */
  frame(s: DebugFrameStats): void {
    // fps averaged over a fixed window of accumulated frame deltas.
    this.fpsFrames += 1;
    this.fpsTime += s.frameDt;
    if (this.fpsTime >= TUNING.debug.fpsWindow) {
      this.fps = this.fpsFrames / this.fpsTime;
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (!this.visible) return;

    const ms = (v: number): string => (v * 1000).toFixed(2);
    const p = s.position;
    const v = s.velocity;
    const hSpeed = Math.hypot(v.x, v.z);
    this.stats.textContent =
      `fps          ${this.fps.toFixed(1)}\n` +
      `frame dt     ${ms(s.frameDt)} ms\n` +
      `sim steps    ${s.steps.toFixed(0)}\n` +
      `accumulator  ${ms(s.accumulator)} ms\n` +
      `pos          ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}\n` +
      `vel          h ${hSpeed.toFixed(2)}  y ${v.y.toFixed(2)}\n` +
      `grounded     ${s.grounded ? 'yes' : 'no'}\n` +
      `state        ${s.state}`;

    this.warn.textContent =
      s.substepCapHits > 0
        ? `\n⚠ SUBSTEP CAP HIT ×${s.substepCapHits.toFixed(0)}${s.drainedThisFrame ? ' — DRAINING NOW' : ''}\n` +
          `  dropped ${ms(s.lastDroppedTime)} ms sim time (slow-mo)`
        : '';
  }
}
