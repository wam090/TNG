import { describe, expect, it } from 'vitest';
import { TUNING } from '../config/tuning';
import { TimeScale } from './TimeScale';

const DT = TUNING.loop.fixedDt;

function stepsActive(ts: TimeScale, source: string, maxSteps: number): number {
  let n = 0;
  while (ts.isActive(source) && n < maxSteps) {
    ts.update(DT);
    n += 1;
  }
  return n;
}

/** Game reads `value` right after update(); count the steps that get a scaled dt. */
function scaledSteps(ts: TimeScale, maxSteps: number): number {
  let n = 0;
  for (let i = 0; i < maxSteps; i += 1) {
    ts.update(DT);
    if (ts.value < 1) n += 1;
  }
  return n;
}

// Float step counts: d/DT can land a hair either side of an integer, so a
// window covers round(d/DT) or one step fewer — never more.
const expectWindow = (n: number, duration: number): void => {
  expect(n).toBeGreaterThanOrEqual(Math.round(duration / DT) - 1);
  expect(n).toBeLessThanOrEqual(Math.round(duration / DT));
};

describe('TimeScale — the one slow-motion mechanism', () => {
  it('is 1 when nothing is active', () => {
    expect(new TimeScale().value).toBe(1);
  });

  it('a single source applies its scale until its RAW-time duration runs out', () => {
    const ts = new TimeScale();
    ts.push('a', 0.25, 0.3);
    expect(ts.value).toBe(0.25);
    expectWindow(scaledSteps(ts, 1000), 0.3);
    expect(ts.value).toBe(1);
  });

  it('pickup dilation and hit-stop combine by MIN — the freeze wins inside a dilation window', () => {
    const ts = new TimeScale();
    const dil = TUNING.elements.pickupTimeDilation;
    ts.push('pickupDilation', dil.scale, dil.duration);
    ts.push('hitStop', TUNING.elements.hitStopScale, TUNING.wind.gust.hitStop);
    expect(ts.value).toBe(Math.min(dil.scale, TUNING.elements.hitStopScale));

    stepsActive(ts, 'hitStop', 1000); // hit-stop expires first…
    expect(ts.isActive('pickupDilation')).toBe(true);
    expect(ts.value).toBe(dil.scale); // …and the dilation resumes, untouched

    stepsActive(ts, 'pickupDilation', 1000);
    expect(ts.value).toBe(1);
  });

  it('MIN is order-independent: a milder source pushed later never loosens a stronger one', () => {
    const ts = new TimeScale();
    ts.push('strong', 0.1, 1);
    ts.push('mild', 0.5, 1);
    expect(ts.value).toBe(0.1);
  });

  it('re-pushing a source restarts its timer instead of stacking', () => {
    const ts = new TimeScale();
    ts.push('a', 0.5, 0.1);
    ts.update(DT);
    ts.update(DT);
    ts.push('a', 0.5, 0.1);
    expectWindow(scaledSteps(ts, 1000), 0.1);
  });

  it('timers tick on raw time: a freeze (scale 0) still expires', () => {
    const ts = new TimeScale();
    ts.push('freeze', 0, 0.04);
    expect(ts.value).toBe(0);
    expectWindow(scaledSteps(ts, 1000), 0.04);
    expect(ts.value).toBe(1);
  });
});
