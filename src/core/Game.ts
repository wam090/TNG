import type * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { Debug } from './Debug';
import type { InputSource } from './Input';
import { Rng } from './Rng';
import type { Time } from './Time';
import type { CameraRig } from '../render/CameraRig';
import type { Renderer } from '../render/Renderer';

export type GameState = 'running'; // grows into the real state machine at M2

export interface GameParts {
  time: Time;
  input: InputSource;
  debug: Debug;
  renderer: Renderer;
  cameraRig: CameraRig;
  scene: THREE.Scene;
  target: THREE.Object3D;
}

/** JSON-serialisable snapshot for the test harness (window.__stillmote.state()). */
export interface GameSnapshot {
  step: number;
  state: GameState;
  target: [number, number, number];
  substepCapHits: number;
}

/**
 * Fixed-timestep loop. Simulation advances in fixed dt substeps driven by an
 * accumulator; rendering happens exactly once per animation frame. The wall
 * clock is read exactly once per frame (via Time) at the loop boundary —
 * update(dt) never sees it.
 *
 * Two drive modes, mutually exclusive:
 *  - start(): real-time rAF loop for play.
 *  - stepManual(n): harness mode. Advances exactly n fixed steps and renders.
 *    Never touches Time or the accumulator, so wall-clock effects (including
 *    substep-cap drains) are structurally impossible in a harness run.
 */
export class Game {
  rng = new Rng(TUNING.rng.defaultSeed);
  private inputSource: InputSource;
  private accumulator = 0;
  private stepCount = 0;
  private substepCapHits = 0;
  private lastDroppedTime = 0;
  private readonly state: GameState = 'running';

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

  /** Harness: advance exactly n fixed sim steps (camera stepped in lockstep), then render once. */
  stepManual(n: number): void {
    const { debug, renderer, cameraRig, scene, target } = this.parts;
    for (let i = 0; i < n; i += 1) {
      this.update(TUNING.loop.fixedDt);
      cameraRig.update(target, TUNING.loop.fixedDt);
      debug.frame({
        frameDt: TUNING.loop.fixedDt,
        steps: 1,
        accumulator: 0,
        substepCapHits: this.substepCapHits,
        lastDroppedTime: this.lastDroppedTime,
        drainedThisFrame: false,
        targetPosition: target.position,
        state: this.state,
      });
    }
    if (n === 0) {
      cameraRig.update(target, 0); // first call snaps; render frame 0 from the rig, not default pose
      debug.frame({
        frameDt: 0,
        steps: 0,
        accumulator: 0,
        substepCapHits: this.substepCapHits,
        lastDroppedTime: this.lastDroppedTime,
        drainedThisFrame: false,
        targetPosition: target.position,
        state: this.state,
      });
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
    const p = this.parts.target.position;
    return {
      step: this.stepCount,
      state: this.state,
      target: [p.x, p.y, p.z],
      substepCapHits: this.substepCapHits,
    };
  }

  private frame(): void {
    const { time, debug, renderer, cameraRig, scene, target } = this.parts;
    const frameDt = time.frameDelta();
    this.accumulator += frameDt;

    let steps = 0;
    let drained = false;
    while (this.accumulator >= TUNING.loop.fixedDt) {
      if (steps >= TUNING.loop.maxSubsteps) {
        // Spiral-of-death guard: drop the backlog instead of carrying it.
        // The sim degrades to slow motion; the overlay makes the drop visible.
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

    // Render-side smoothing uses the real frame delta — frame-rate independent
    // via damp(), and the camera stays fluid even on 0-substep frames.
    cameraRig.update(target, frameDt);
    renderer.render(scene, cameraRig.camera);

    debug.frame({
      frameDt,
      steps,
      accumulator: this.accumulator,
      substepCapHits: this.substepCapHits,
      lastDroppedTime: this.lastDroppedTime,
      drainedThisFrame: drained,
      targetPosition: target.position,
      state: this.state,
    });
  }

  private update(_dt: number): void {
    // M0: nothing simulates yet. Polling still runs each substep so edge
    // detection lands on fixed-step boundaries from day one.
    this.inputSource.poll();
    this.stepCount += 1;
  }
}
