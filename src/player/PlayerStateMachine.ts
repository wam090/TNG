import { TUNING } from '../config/tuning';

// 'glide' and 'gust' are reserved slots — they become reachable at M4.
export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'glide' | 'gust';

export interface StateContext {
  grounded: boolean;
  verticalVelocity: number;
  horizontalSpeed: number;
  jumped: boolean;
  landed: boolean;
}

export class PlayerStateMachine {
  private state: PlayerState = 'idle';
  private landTimer = 0;

  get current(): PlayerState {
    return this.state;
  }

  update(dt: number, ctx: StateContext): PlayerState {
    if (ctx.jumped) {
      this.state = 'jump';
      return this.state;
    }
    if (ctx.landed) {
      this.state = 'land';
      this.landTimer = TUNING.player.anim.landDuration;
      return this.state;
    }

    switch (this.state) {
      case 'land':
        this.landTimer -= dt;
        if (this.landTimer <= 0) this.state = this.groundedState(ctx);
        break;
      case 'jump':
        if (ctx.verticalVelocity <= 0) this.state = ctx.grounded ? this.groundedState(ctx) : 'fall';
        break;
      case 'fall':
        if (ctx.grounded) this.state = this.groundedState(ctx);
        break;
      case 'idle':
      case 'run':
        if (!ctx.grounded) this.state = ctx.verticalVelocity > 0 ? 'jump' : 'fall';
        else this.state = this.groundedState(ctx);
        break;
      case 'glide':
      case 'gust':
        // Unreachable until M4 wires the wind abilities in.
        this.state = 'fall';
        break;
    }
    return this.state;
  }

  private groundedState(ctx: StateContext): PlayerState {
    return ctx.horizontalSpeed > TUNING.player.anim.runThreshold ? 'run' : 'idle';
  }
}
