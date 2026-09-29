import { TUNING } from '../config/tuning';
import type { CardFrame, LevelCompleteView } from './LevelComplete';

// Placeholder look (the VP owns it; card flourishes are M5). No words anywhere —
// glyphs and numbers only (SPEC pillar 3). Dark ink reads on every light sky.
const INK = '#22292E';
const KEY_TEXT = '#F2EDE4'; // the creature's off-white, as on the D3 prompt keycap
const MONO = 'ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace';

const ROOT_CSS = 'position:fixed;inset:0;z-index:950;pointer-events:none;display:none;';
const LAYER_CSS = 'position:absolute;inset:0;';
const CONTENT_CSS =
  `${LAYER_CSS}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;` +
  `color:${INK};font:600 30px/1 ${MONO};`;
const ROW_CSS = 'display:flex;align-items:center;gap:12px;';
const KEYCAP_CSS =
  'min-width:40px;height:38px;padding:0 10px;box-sizing:border-box;display:flex;align-items:center;' +
  `justify-content:center;border:2px solid ${INK};border-bottom-width:5px;border-radius:7px;` +
  `background:${INK};color:${KEY_TEXT};font:600 26px/1 ${MONO};`;

const svg = (size: number, body: string): string =>
  `<svg width="${size.toFixed(0)}" height="${size.toFixed(0)}" viewBox="0 0 24 24" fill="none" ` +
  `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
// Done: a closed ring with a check. Clock: face + hands. Replay: a looping arrow.
const DONE_GLYPH = svg(88, '<circle cx="12" cy="12" r="10.5"/><path d="M7 12.4l3.3 3.3L17.2 8.6"/>');
const CLOCK_GLYPH = svg(30, '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.8V12l3.6 2.2"/>');
const REPLAY_GLYPH = svg(28, '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.6 3.8v3.9h3.9"/>');
// Shard: the violet tetrahedron's silhouette, one facet line (TUNING.props.shard.color).
const SHARD_GLYPH =
  `<svg width="30" height="30" viewBox="0 0 24 24" stroke-linejoin="round">` +
  `<path d="M12 2.5L21.5 20H2.5z" fill="${TUNING.props.shard.color}" stroke="${INK}" stroke-width="1.5"/>` +
  `<path d="M12 2.5L14 20" stroke="${INK}" stroke-width="1.2" fill="none"/></svg>`;

function div(css: string, html = ''): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = css;
  el.innerHTML = html;
  return el;
}

/**
 * The Level Complete card's DOM: a sky-coloured veil and a centred column —
 * done glyph, clock + time, shard + found/total, replay arrow + Jump keycap.
 * Everything is set from the CardFrame each step; no CSS animation, so the
 * harness sees exactly what the sim state says.
 */
export class LevelCompleteCard implements LevelCompleteView {
  private readonly root = div(ROOT_CSS);
  private readonly veil = div(LAYER_CSS);
  private readonly content = div(CONTENT_CSS);
  private readonly time = document.createElement('span');
  private readonly shardRow = div(ROW_CSS, SHARD_GLYPH);
  private readonly shardCount = document.createElement('span');
  private readonly replayRow = div(ROW_CSS, REPLAY_GLYPH);
  private readonly keycap = div(KEYCAP_CSS);
  private last = '';

  constructor() {
    const timeRow = div(ROW_CSS, CLOCK_GLYPH);
    timeRow.append(this.time);
    this.shardRow.append(this.shardCount);
    this.replayRow.append(this.keycap);
    this.content.append(div('', DONE_GLYPH), timeRow, this.shardRow, this.replayRow);
    this.root.append(this.veil, this.content);
    this.root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.root);
  }

  draw(f: CardFrame): void {
    const key = JSON.stringify(f);
    if (key === this.last) return;
    this.last = key;
    this.root.style.display = 'block';
    this.veil.style.background = f.sky;
    this.veil.style.opacity = (f.fade * TUNING.ui.levelComplete.fadeOpacity).toFixed(3);
    this.content.style.opacity = f.fade.toFixed(3);
    this.time.textContent = f.time;
    this.shardRow.style.display = f.shards ? 'flex' : 'none';
    this.shardCount.textContent = f.shards ? `${f.shards.found.toFixed(0)}/${f.shards.total.toFixed(0)}` : '';
    // The prompt keeps its space during the hold, so nothing shifts when it appears.
    this.replayRow.style.visibility = f.replayGlyph === null ? 'hidden' : 'visible';
    this.keycap.textContent = f.replayGlyph ?? '';
  }

  hide(): void {
    this.last = '';
    this.root.style.display = 'none';
  }
}
