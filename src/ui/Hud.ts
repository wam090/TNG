const SLOT_CSS =
  'position:fixed;left:16px;bottom:16px;width:34px;height:34px;border-radius:50%;' +
  'border:3px solid rgba(255,255,255,0.35);box-sizing:border-box;z-index:800;' +
  'pointer-events:none;background:transparent;';
const FILLED_BORDER = 'rgba(255,255,255,0.7)';
const EMPTY_BORDER = 'rgba(255,255,255,0.35)';

/**
 * One element slot, bottom-left: empty ring → filled ring in the element
 * colour. No text (SPEC pillar 3). State-driven, no CSS animation — the
 * harness screenshots it, so it must be deterministic.
 */
export class Hud {
  private readonly slot: HTMLDivElement;

  constructor() {
    this.slot = document.createElement('div');
    this.slot.style.cssText = SLOT_CSS;
    document.body.appendChild(this.slot);
  }

  setSlot(colorHex: string | null): void {
    this.slot.style.background = colorHex ?? 'transparent';
    this.slot.style.borderColor = colorHex ? FILLED_BORDER : EMPTY_BORDER;
  }
}
