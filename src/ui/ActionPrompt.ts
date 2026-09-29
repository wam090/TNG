import type { InputDevice } from '../core/Input';

// Sits just right of the HUD element slot (Hud.ts: 16px inset + 34px slot).
const PROMPT_CSS =
  'position:fixed;left:62px;bottom:18px;min-width:30px;height:30px;padding:0 8px;box-sizing:border-box;' +
  'display:none;align-items:center;justify-content:center;z-index:800;pointer-events:none;' +
  'border:2px solid rgba(255,255,255,0.75);border-bottom-width:4px;border-radius:7px;' +
  'background:rgba(34,41,46,0.72);color:#F2EDE4;' +
  'font:600 15px/1 ui-monospace,Menlo,Consolas,monospace;';

/**
 * Beat 2's prompt (SPEC §6.2: "icon only — no words"): a key-cap showing the
 * ACTION binding for the last-used device, shown from the Core pickup until
 * the first push fires. Placeholder look — the VP owns it. State-driven, no
 * CSS animation, so harness screenshots stay deterministic.
 */
export class ActionPrompt {
  private readonly el: HTMLDivElement;
  private dismissed = false;
  private glyph = '';

  constructor(
    private readonly device: () => InputDevice,
    private readonly glyphFor: (device: InputDevice) => string,
  ) {
    this.el = document.createElement('div');
    this.el.style.cssText = PROMPT_CSS;
    this.el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.el);
  }

  /** The element that grants the action was picked up. */
  show(): void {
    if (this.dismissed) return;
    this.refresh();
    this.el.style.display = 'flex';
  }

  /** The action was used for the first time: the prompt has done its job. */
  dismiss(): void {
    this.dismissed = true;
    this.el.style.display = 'none';
  }

  /** Replay: hidden, and armed to show again at the next pickup. */
  reset(): void {
    this.dismissed = false;
    this.el.style.display = 'none';
  }

  /** Once per sim step: follow the last-used device. */
  refresh(): void {
    const glyph = this.glyphFor(this.device());
    if (glyph !== this.glyph) {
      this.glyph = glyph;
      this.el.textContent = glyph;
    }
  }
}
