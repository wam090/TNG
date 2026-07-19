const FADE_CSS =
  'position:fixed;inset:0;background:#000;pointer-events:none;z-index:900;opacity:0;';

/** Fullscreen black overlay for the respawn fade. Opacity is driven from sim state each frame. */
export class FadeOverlay {
  private readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = FADE_CSS;
    document.body.appendChild(this.el);
  }

  set(opacity: number): void {
    this.el.style.opacity = opacity.toFixed(3);
  }
}
