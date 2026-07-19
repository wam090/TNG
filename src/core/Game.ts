import type * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { Debug } from './Debug';
import type { InputSource } from './Input';
import { Rng } from './Rng';
import type { Time } from './Time';
import type { Player } from '../player/Player';
import type { CameraRig } from '../render/CameraRig';
import type { Renderer } from '../render/Renderer';
import type { FadeOverlay } from '../ui/FadeOverlay';

export interface GameParts {
  time: Time;
  input: InputSource;
  debug: Debug;
  renderer: Renderer;
  cameraRig: CameraRig;
  scene: THREE.Scene;
  player: Player;
  fade?: FadeOverlay;
}

/** JSON-serialisable snapshot for the test harness (window.__stillmote.state()). */
export interface GameSnapshot {
  step: number;
  state: string;
  player: [number, number, number];
  velocity: [number, number, number];
  grounded: boolean;
  substepCapHits: number;
}

/**
 * Fixed-timestep loop. Simulation advances in fixed dt substeps driven by an
 * accumulator; rendering happens exactly once per animation frame, with the
 * player drawn at lerp(prev, curr, alpha) where alpha = accumulator/fixedDt —
 * a 60Hz sim stays smooth at any render rate. The wall clock is read exactly
 * once per frame (via Time) at the loop boundary; update(dt) never sees it.
 *
 * Two drive modes, mutually exclusive:
 *  - start(): real-time rAF loop for play.
 *  - stepManual(n): harness mode. Advances exactly n fixed steps and renders
 *    at alpha=1 (exact sim state). Never touches Time or the accumulator, so
 *    wall-clock effects (incl. substep-cap drains) are impossible here.
 */
export class Game {
  rng = new Rng(TUNING.rng.defaultSeed);
  private inputSource: InputSource;
  private accumulator = 0;
  private stepCount = 0;
  private substepCapHits = 0;
  private lastDroppedTime = 0;

  constructor(private readonly parts: GameParts) {
    this.inputSource = parts.input;
  }

  start(): void {
    const loop = (): void => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Harness: advance exactly n fixed sim steps (camera in lockstep), then render once. */
  stepManual(n: number): void {
    const { debug, renderer, cameraRig, scene, player } = this.parts;
    for (let i = 0; i < n; i += 1) {
      this.update(TUNING.loop.fixedDt);
      player.syncVisual(1);
      cameraRig.update(player.renderPosition, player.velocity, TUNING.loop.fixedDt);
      debug.frame(this.debugStats(TUNING.loop.fixedDt, 1, false));
    }
    if (n === 0) {
      player.syncVisual(1);
      cameraRig.update(player.renderPosition, player.velocity, 0);
      debug.frame(this.debugStats(0, 0, false));
    }
    renderer.render(scene, cameraRig.camera);
  }

  /** Harness: swap device input for a scripted timeline. */
  setInputSource(source: InputSource): void {
    this.inputSource = source;
  }

  /** Harness: replace the RNG deterministically. */
  reseed(seed: number): void {
    this.rng = new Rng(seed);
  }

  snapshot(): GameSnapshot {
    const p = this.parts.player;
    return {
      step: this.stepCount,
      state: p.state,
      player: [p.position.x, p.position.y, p.position.z],
      velocity: [p.velocity.x, p.velocity.y, p.velocity.z],
      grounded: p.grounded,
      substepCapHits: this.substepCapHits,
    };
  }

  private frame(): void {
    const { time, debug, renderer, cameraRig, scene, player, fade } = this.parts;
    const frameDt = time.frameDelta();
    this.accumulator += frameDt;

    let steps = 0;
    let drained = false;
    while (this.accumulator >= TUNING.loop.fixedDt) {
      if (steps >= TUNING.loop.maxSubsteps) {
        // Spiral-of-death guard: drop the backlog instead of carrying it.
        this.lastDroppedTime = this.accumulator;
        this.accumulator = 0;
        this.substepCapHits += 1;
        drained = true;
        break;
      }
      this.update(TUNING.loop.fixedDt);
      this.accumulator -= TUNING.loop.fixedDt;
      steps += 1;
    }

    // Render interpolation (SPEC M2 requirement): the player is drawn between
    // the previous and current sim transforms by the accumulator fraction.
    const alpha = this.accumulator / TUNING.loop.fixedDt;
    player.syncVisual(alpha);
    cameraRig.update(player.renderPosition, player.velocity, frameDt);
    fade?.set(player.fadeOpacity);
    renderer.render(scene, cameraRig.camera);
    debug.frame(this.debugStats(frameDt, steps, drained));
  }

  private update(dt: number): void {
    const snap = this.inputSource.poll();
    this.parts.player.update(dt, snap);
    this.stepCount += 1;
  }

  private debugStats(frameDt: number, steps: number, drained: boolean) {
    const p = this.parts.player;
    return {
      frameDt,
      steps,
      accumulator: this.accumulator,
      substepCapHits: this.substepCapHits,
      lastDroppedTime: this.lastDroppedTime,
      drainedThisFrame: drained,
      position: p.position,
      velocity: p.velocity,
      grounded: p.grounded,
      state: p.state,
    };
  }
}
