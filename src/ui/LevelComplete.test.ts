import { describe, expect, it } from 'vitest';
import { TUNING } from '../config/tuning';
import { NO_INPUT, type InputSnapshot } from '../core/Input';
import { TimeScale } from '../core/TimeScale';
import { formatRunTime, LevelComplete, type CardFrame, type LevelCompleteView } from './LevelComplete';

const DT = TUNING.loop.fixedDt;
const L = TUNING.ui.levelComplete;
const press = (over: Partial<InputSnapshot>): InputSnapshot => ({ ...NO_INPUT, ...over });
const JUMP_PRESS = press({ jumpPressed: true, jumpHeld: true });
const JUMP_HELD = press({ jumpHeld: true });
const ACTION_PRESS = press({ actionPressed: true, actionHeld: true });
const RESULT = { shardsFound: 0, shardsTotal: 0, sky: '#DCE7EE' };

class FakeView implements LevelCompleteView {
  frames: CardFrame[] = [];
  hidden = 0;
  draw(frame: CardFrame): void {
    this.frames.push(frame);
  }
  hide(): void {
    this.hidden += 1;
  }
  get last(): CardFrame | undefined {
    return this.frames[this.frames.length - 1];
  }
}

function make(): { lc: LevelComplete; ts: TimeScale; view: FakeView; replays: { n: number } } {
  const ts = new TimeScale();
  const view = new FakeView();
  const replays = { n: 0 };
  const lc: LevelComplete = new LevelComplete(ts, view, () => '␣', () => {
    replays.n += 1;
    lc.reset(); // what LevelRun.start() does to it
  });
  return { lc, ts, view, replays };
}

describe('run time format — m:ss.s, tenths truncated', () => {
  it.each([
    [0, '0:00.0'],
    [1.25, '0:01.2'],
    [59.96, '0:59.9'],
    [60, '1:00.0'],
    [83.45, '1:23.4'],
    [600, '10:00.0'],
  ])('%s s → %s', (s, text) => {
    expect(formatRunTime(s)).toBe(text);
  });

  it('60 fixed steps of 1/60 s read exactly 0:01.0 (float sum rounded to the ms first)', () => {
    let t = 0;
    for (let i = 0; i < 60; i += 1) t += DT;
    expect(formatRunTime(t)).toBe('0:01.0');
  });
});

describe('Level Complete — the moment (WO-005 Stage A)', () => {
  it('the clock counts raw steps until the Goal and then stops', () => {
    const { lc } = make();
    for (let i = 0; i < 90; i += 1) expect(lc.step(DT, NO_INPUT)).toBe(false);
    lc.complete(RESULT);
    for (let i = 0; i < 90; i += 1) lc.step(DT, NO_INPUT);
    expect(lc.elapsed).toBeCloseTo(90 * DT, 9);
  });

  it('the Goal freezes the sim through TimeScale (MIN rule: under a dilation it is still 0)', () => {
    const { lc, ts } = make();
    ts.push('pickupDilation', 0.25, 10);
    lc.complete(RESULT);
    expect(ts.value).toBe(0);
    for (let i = 0; i < 600; i += 1) {
      lc.step(DT, NO_INPUT);
      ts.update(DT);
    }
    expect(ts.value).toBe(0); // no natural end
  });

  it('fades in over fadeTime; the replay prompt appears only after holdBeforeInput', () => {
    const { lc, view } = make();
    lc.complete(RESULT);
    expect(view.last?.fade).toBe(0);
    expect(view.last?.replayGlyph).toBeNull();
    let fullAt = -1;
    let promptAt = -1;
    for (let i = 1; i <= 60; i += 1) {
      lc.step(DT, NO_INPUT);
      if (fullAt < 0 && view.last?.fade === 1) fullAt = i;
      if (promptAt < 0 && view.last?.replayGlyph === '␣') promptAt = i;
    }
    expect(fullAt).toBeGreaterThanOrEqual(Math.round(L.fadeTime / DT) - 1);
    expect(fullAt).toBeLessThanOrEqual(Math.round(L.fadeTime / DT) + 1);
    expect(promptAt).toBeGreaterThanOrEqual(Math.round(L.holdBeforeInput / DT) - 1);
    expect(promptAt).toBeLessThanOrEqual(Math.round(L.holdBeforeInput / DT) + 1);
  });

  it('while the card is up every step is withheld from the sim', () => {
    const { lc } = make();
    lc.complete(RESULT);
    for (let i = 0; i < 30; i += 1) expect(lc.step(DT, JUMP_HELD)).toBe(true);
  });

  it('a press during the hold does nothing, and a key held through the hold never replays', () => {
    const { lc, replays } = make();
    lc.complete(RESULT);
    lc.step(DT, JUMP_PRESS); // pressed on the Goal step's heels
    for (let i = 0; i < 120; i += 1) lc.step(DT, JUMP_HELD); // …and never let go
    expect(replays.n).toBe(0);
    expect(lc.isShowing).toBe(true);
  });

  it('after the hold a fresh Jump press replays once; that step is withheld and is the new run’s first', () => {
    const { lc, ts, view, replays } = make();
    for (let i = 0; i < 30; i += 1) lc.step(DT, NO_INPUT);
    lc.complete(RESULT);
    while (!lc.accepting) lc.step(DT, NO_INPUT);
    expect(lc.step(DT, JUMP_PRESS)).toBe(true);
    expect(replays.n).toBe(1);
    expect(lc.isShowing).toBe(false);
    expect(view.hidden).toBe(1);
    expect(ts.value).toBe(1); // the freeze is released
    expect(lc.elapsed).toBeCloseTo(DT, 12); // exactly as after one step of a fresh load
    expect(lc.step(DT, JUMP_PRESS)).toBe(false); // the next run plays normally
    expect(replays.n).toBe(1);
  });

  it('Action replays too', () => {
    const { lc, replays } = make();
    lc.complete(RESULT);
    while (!lc.accepting) lc.step(DT, NO_INPUT);
    lc.step(DT, ACTION_PRESS);
    expect(replays.n).toBe(1);
  });

  it('the shard row: hidden when the level has none, found/total when it has some', () => {
    const none = make();
    none.lc.complete(RESULT);
    expect(none.view.last?.shards).toBeNull();
    const some = make();
    some.lc.complete({ ...RESULT, shardsFound: 1, shardsTotal: 3 });
    expect(some.view.last?.shards).toEqual({ found: 1, total: 3 });
  });

  it('the card carries the level’s sky colour and the time as m:ss.s', () => {
    const { lc, view } = make();
    for (let i = 0; i < 75 * 60 + 27; i += 1) lc.step(DT, NO_INPUT);
    lc.complete({ ...RESULT, sky: '#123456' });
    expect(view.last?.sky).toBe('#123456');
    expect(view.last?.time).toBe('1:15.4');
  });

  it('a second Goal report while the card is up changes nothing', () => {
    const { lc, view } = make();
    lc.complete(RESULT);
    const n = view.frames.length;
    lc.complete({ ...RESULT, sky: '#000000' });
    expect(view.frames.length).toBe(n);
  });
});
