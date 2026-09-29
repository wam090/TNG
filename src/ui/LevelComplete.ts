import { TUNING } from '../config/tuning';
import type { InputSnapshot } from '../core/Input';
import { clamp } from '../core/Math';
import type { TimeScale } from '../core/TimeScale';

const FREEZE_SOURCE = 'levelComplete';
const FREEZE_SCALE = 0; // the sim stops; raw-time timers (this card, envelopes) keep running
const MS_PER_S = 1000;
const MS_PER_TENTH = 100;
const TENTHS_PER_MINUTE = 600;
const TENTHS_PER_SECOND = 10;
const TWO_DIGITS = 10;

/** What the Goal hands over when the level is done. */
export interface LevelResult {
  shardsFound: number;
  shardsTotal: number;
  sky: string;
}

/** One state of the card — icons and numbers only, no words (SPEC pillar 3). */
export interface CardFrame {
  /** Raw run time, m:ss.s. */
  time: string;
  /** null hides the shard row (the level has no shards). */
  shards: { found: number; total: number } | null;
  sky: string;
  /** 0..1: how far the fade (and the card) has come in. */
  fade: number;
  /** The Jump glyph once replay is accepted; null during the hold. */
  replayGlyph: string | null;
}

/** The card's look lives behind this (LevelCompleteCard); the logic stays DOM-free and testable. */
export interface LevelCompleteView {
  draw(frame: CardFrame): void;
  hide(): void;
}

/** m:ss.s with tenths TRUNCATED (59.96 s reads 0:59.9). Rounded to the ms first, so 60 × 1/60 s is 0:01.0. */
export function formatRunTime(seconds: number): string {
  const tenths = Math.floor(Math.round(seconds * MS_PER_S) / MS_PER_TENTH);
  const minutes = Math.floor(tenths / TENTHS_PER_MINUTE);
  const secs = (tenths % TENTHS_PER_MINUTE) / TENTHS_PER_SECOND;
  return `${minutes.toFixed(0)}:${secs < TWO_DIGITS ? '0' : ''}${secs.toFixed(1)}`;
}

/**
 * The Level Complete moment (SPEC §8.5; pulled forward from M6 by WO-005).
 *
 * - The run clock counts RAW fixed-step time from the run's start to the
 *   Goal, so pickup dilation and hit-stop never shorten it. No wall clock.
 * - On the Goal it freezes the sim through the ONE TimeScale mechanism and
 *   draws the card, fading toward the level's sky over `fadeTime`.
 * - While the card is up the sim gets no input. After `holdBeforeInput`, a
 *   fresh Jump or Action PRESS replays: `onReplay` is LevelRun.start(), the
 *   same path as a fresh load, which calls reset() on this too.
 *
 * Stepped once per fixed step by Game, BEFORE the sim, on raw dt. State-
 * driven (no CSS animation), so harness frames are deterministic.
 */
export class LevelComplete {
  private runTime = 0;
  private cardTime = 0;
  private result: LevelResult | null = null; // non-null = the card is up

  constructor(
    private readonly timeScale: TimeScale,
    private readonly view: LevelCompleteView,
    private readonly replayGlyph: () => string,
    private readonly onReplay: () => void,
  ) {}

  /** The Goal was reached: stop the clock, freeze the sim, bring the card in. */
  complete(result: LevelResult): void {
    if (this.result) return;
    this.result = result;
    this.cardTime = 0;
    this.timeScale.push(FREEZE_SOURCE, FREEZE_SCALE, Infinity);
    this.draw();
  }

  /** One fixed step on RAW dt. Returns true when the sim must not see this step's input. */
  step(rawDt: number, snap: InputSnapshot): boolean {
    if (!this.result) {
      this.runTime += rawDt;
      return false;
    }
    this.cardTime += rawDt;
    if (this.accepting && (snap.jumpPressed || snap.actionPressed)) {
      this.onReplay(); // a fresh load — reset() below has run by the time this returns
      this.runTime += rawDt; // this step is the new run's first, exactly as after a fresh load
      return true; // the press that replays must not also make him jump
    }
    this.draw();
    return true;
  }

  /** Replay: clock at zero, card gone, freeze released. */
  reset(): void {
    this.runTime = 0;
    this.cardTime = 0;
    this.result = null;
    this.timeScale.release(FREEZE_SOURCE);
    this.view.hide();
  }

  /** Raw seconds of the current run (stops at the Goal). */
  get elapsed(): number {
    return this.runTime;
  }

  get isShowing(): boolean {
    return this.result !== null;
  }

  /** Past the hold: a fresh press now replays. */
  get accepting(): boolean {
    return this.result !== null && this.cardTime >= TUNING.ui.levelComplete.holdBeforeInput;
  }

  private draw(): void {
    const r = this.result;
    if (!r) return;
    const L = TUNING.ui.levelComplete;
    this.view.draw({
      time: formatRunTime(this.runTime),
      shards: r.shardsTotal > 0 ? { found: r.shardsFound, total: r.shardsTotal } : null,
      sky: r.sky,
      fade: clamp(this.cardTime / L.fadeTime, 0, 1),
      replayGlyph: this.accepting ? this.replayGlyph() : null,
    });
  }
}
