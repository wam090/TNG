import { describe, expect, it } from 'vitest';
import { GlidePrompt, type GlideCue, type GlideKeycap } from './GlidePrompt';

class FakeKeycap implements GlideKeycap {
  visible = false;
  dismissed = false;
  show(): void {
    if (!this.dismissed) this.visible = true;
  }
  dismiss(): void {
    this.dismissed = true;
    this.visible = false;
  }
  reset(): void {
    this.dismissed = false;
    this.visible = false;
  }
}

const RISING: GlideCue = { rising: true, falling: false, gliding: false };
const FALLING: GlideCue = { rising: false, falling: true, gliding: false };
const GROUNDED: GlideCue = { rising: false, falling: false, gliding: false };
const GLIDING: GlideCue = { rising: false, falling: true, gliding: true };
const make = (): { p: GlidePrompt; k: FakeKeycap } => {
  const k = new FakeKeycap();
  return { p: new GlidePrompt(k), k };
};

describe('glide prompt (WO-006 Stage A) — from the first fall after the first lift, until the first glide', () => {
  it('a fall with no lift before it shows nothing (jumping around the yard never prompts)', () => {
    const { p, k } = make();
    p.step(FALLING);
    expect(k.visible).toBe(false);
  });

  it('a lift arms it; it shows on the first FALLING step after he has risen, not while he is still going up', () => {
    const { p, k } = make();
    p.lifted();
    p.step(RISING);
    expect(k.visible).toBe(false);
    p.step(FALLING);
    expect(k.visible).toBe(true);
  });

  it('dropping INTO a column (the lift starts while he still falls) does not show it until the column has lifted him', () => {
    const { p, k } = make();
    p.lifted();
    p.step(FALLING); // still dropping onto the grate as the lift begins
    expect(k.visible).toBe(false);
    p.step(RISING);
    p.step(FALLING);
    expect(k.visible).toBe(true);
  });

  it('it stays up (landing included) until the first glide, then never again this run', () => {
    const { p, k } = make();
    p.lifted();
    p.step(RISING);
    p.step(FALLING);
    p.step(GROUNDED); // landed without gliding: still showing
    expect(k.visible).toBe(true);
    p.step(GLIDING);
    expect(k.visible).toBe(false);
    expect(p.isDone).toBe(true);
    p.lifted();
    p.step(FALLING);
    expect(k.visible).toBe(false);
  });

  it('a glide before any lift means he already knows: it never shows', () => {
    const { p, k } = make();
    p.step(GLIDING);
    p.lifted();
    p.step(FALLING);
    expect(k.visible).toBe(false);
  });

  it('a replay resets it: the next run teaches again', () => {
    const { p, k } = make();
    p.lifted();
    p.step(GLIDING);
    p.reset();
    p.lifted();
    p.step(RISING);
    p.step(FALLING);
    expect(k.visible).toBe(true);
  });
});
