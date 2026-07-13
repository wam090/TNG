import type * as THREE from 'three';
import { TUNING } from '../config/tuning';
import type { Debug } from './Debug';
import type { Input } from './Input';
import type { Time } from './Time';
import type { CameraRig } from '../render/CameraRig';
import type { Renderer } from '../render/Renderer';

export type GameState = 'running'; // grows into the real state machine at M2

export interface GameParts {
  time: Time;
  input: Input;
  debug: Debug;
  renderer: Renderer;
  cameraRig: CameraRig;
  scene: THREE.Scene;
  target: THREE.Object3D;
}

/**
 * Fixed-timestep loop. Simulation advances in fixed dt substeps driven by an
 * accumulator; rendering happens exactly once per animation frame. The wall
 * clock is read exactly once per frame (via Time) at the loop boundary —
 * update(dt) never sees it.
 */
export class Game {
  private accumulator = 0;
  private substepCapHits = 0;
  private lastDroppedTime = 0;
  private readonly state: GameState = 'running';

  constructor(private readonly parts: GameParts) {}

  start(): void {
    const loop = (): void => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
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
    this.parts.input.poll();
  }
}
