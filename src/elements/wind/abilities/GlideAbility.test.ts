import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { AbilityContext } from '../../../abilities/Ability';
import { TUNING } from '../../../config/tuning';
import type { InputSnapshot } from '../../../core/Input';
import { Player } from '../../../player/Player';
import { windModule } from '../WindModule';
import { GlideAbility } from './GlideAbility';

const DT = TUNING.loop.fixedDt;
const GL = TUNING.wind.glide;
const WIND = { ...TUNING.player.baseStats, ...TUNING.wind.statMods };

function ctx(over: Partial<AbilityContext> = {}): AbilityContext {
  return {
    grounded: false,
    verticalVelocity: -4,
    airTime: 1,
    feet: new THREE.Vector3(),
    facing: { x: 0, z: 1 },
    moveDir: { x: 0, z: 0 },
    jumpPressed: true,
    jumpHeld: true,
    actionPressed: false,
    stats: { ...WIND },
    tags: [],
    groundWithin: () => false,
    ...over,
  };
}

describe('Glide — when it may start', () => {
  const glide = new GlideAbility();

  it('starts on a NEW jump press while airborne and falling, after minAirTime', () => {
    expect(glide.canUse(ctx())).toBe(true);
  });

  it('never on the ground, never while rising', () => {
    expect(glide.canUse(ctx({ grounded: true }))).toBe(false);
    expect(glide.canUse(ctx({ verticalVelocity: 2 }))).toBe(false);
  });

  it("the jump's own held button never glides — it needs a new press", () => {
    expect(glide.canUse(ctx({ jumpPressed: false, jumpHeld: true }))).toBe(false);
  });

  it('not before minAirTime — so a coyote jump (coyoteTime < minAirTime) stays a jump', () => {
    expect(TUNING.player.coyoteTime).toBeLessThan(GL.minAirTime);
    expect(glide.canUse(ctx({ airTime: GL.minAirTime * 0.9 }))).toBe(false);
  });

  it('the buffered jump wins when the ground is inside the jump-buffer reach', () => {
    const vy = -10;
    const reach = -vy * TUNING.player.jumpBuffer;
    expect(glide.canUse(ctx({ verticalVelocity: vy, groundWithin: (d) => d >= reach }))).toBe(false);
    expect(glide.canUse(ctx({ verticalVelocity: vy, groundWithin: (d) => d > reach * 2 }))).toBe(true);
  });
});

describe('Glide — while active', () => {
  const glide = new GlideAbility();

  it('continues while Jump is held and airborne; ends on release or landing', () => {
    expect(glide.update(DT, ctx())).toBe(true);
    expect(glide.update(DT, ctx({ jumpHeld: false }))).toBe(false);
    expect(glide.update(DT, ctx({ grounded: true }))).toBe(false);
  });

  it('overrides fall speed and air control; horizontal speed = moveSpeed × horizontalDrag', () => {
    expect(glide.statOverrides(ctx())).toEqual({
      maxFallSpeed: GL.maxFallSpeed,
      airControl: GL.airControl,
      moveSpeed: WIND.moveSpeed * GL.horizontalDrag,
    });
  });
});

describe('Glide — through the real Player (element-blind wiring)', () => {
  const snap = (over: Partial<InputSnapshot> = {}): InputSnapshot => ({
    move: { x: 0, y: 0 },
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    actionPressed: false,
    actionHeld: false,
    actionReleased: false,
    ...over,
  });

  function fallThenGlide(): { player: Player; vyBefore: number } {
    const player = new Player(new THREE.Scene(), () => null);
    player.spawnAt(new THREE.Vector3(0, 200, 0));
    player.addElement(windModule);
    for (let i = 0; i < 60; i += 1) player.update(DT, DT, snap());
    const vyBefore = player.velocity.y;
    player.update(DT, DT, snap({ jumpPressed: true, jumpHeld: true }));
    return { player, vyBefore };
  }

  it('pressing Jump mid-fall enters glide and caps the fall at glide.maxFallSpeed', () => {
    const { player, vyBefore } = fallThenGlide();
    expect(vyBefore).toBeLessThan(-GL.maxFallSpeed);
    expect(player.state).toBe('glide');
    for (let i = 0; i < 30; i += 1) player.update(DT, DT, snap({ jumpHeld: true }));
    expect(player.velocity.y).toBeGreaterThanOrEqual(-GL.maxFallSpeed - 1e-9);
  });

  it('releasing Jump ends the glide and normal falling resumes', () => {
    const { player } = fallThenGlide();
    for (let i = 0; i < 10; i += 1) player.update(DT, DT, snap({ jumpHeld: true }));
    for (let i = 0; i < 30; i += 1) player.update(DT, DT, snap());
    expect(player.state).toBe('fall');
    expect(player.velocity.y).toBeLessThan(-GL.maxFallSpeed - 1);
  });

  it('revoking the element mid-glide ends it immediately (loadout reversibility)', () => {
    const { player } = fallThenGlide();
    player.clearElements();
    player.update(DT, DT, snap({ jumpHeld: true }));
    expect(player.state).not.toBe('glide');
  });
});
