import { TUNING } from '../config/tuning';

// 'glide' and 'gust' are driven by whichever active ability reports them.
export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'glide' | 'gust';

export interface StateContext {
  grounded: boolean;
  verticalVelocity: number;
  horizontalSpeed: number;
  jumped: boolean;
  landed: boolean;
  /** State reported by an active ability (glide/gust), or null. */
  ability: PlayerState | null;
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
    if (ctx.ability) {
      this.state = ctx.ability;
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
        // The ability just ended: resume whatever the body is doing.
        if (ctx.grounded) this.state = this.groundedState(ctx);
        else this.state = ctx.verticalVelocity > 0 ? 'jump' : 'fall';
        break;
    }
    return this.state;
  }

  private groundedState(ctx: StateContext): PlayerState {
    return ctx.horizontalSpeed > TUNING.player.anim.runThreshold ? 'run' : 'idle';
  }
}
