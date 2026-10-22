import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../../config/tuning';
import type { InputSnapshot } from '../../core/Input';
import { Player } from '../../player/Player';
import type { PlayerState } from '../../player/PlayerStateMachine';
import type { PlayerRuntimeState } from '../ElementModule';
import { CrownRotor, crownRotor } from './CrownRotor';
import { windModule } from './WindModule';

const DT = TUNING.loop.fixedDt;
const ROTOR = TUNING.wind.rotor;
const TWO_PI = Math.PI * 2;

const at = (state: PlayerState, grounded: boolean): PlayerRuntimeState => ({
  state,
  grounded,
  horizontalSpeed: 0,
  verticalVelocity: grounded ? 0 : -3,
});
const GLIDE = at('glide', false);

function built(): CrownRotor {
  const obj = crownRotor.build({ socket: new THREE.Object3D() });
  if (!(obj instanceof CrownRotor)) throw new Error('the crown spec must build a CrownRotor');
  return obj;
}

/** Step the spec's animate() for `seconds` of world time in steps of `dt`. */
function drive(rotor: CrownRotor, s: PlayerRuntimeState, seconds: number, dt = DT): void {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i += 1) crownRotor.animate?.(rotor, dt, s);
}

describe('Crown rotor (WO-007) — when it shows', () => {
  it('Wind bolts it onto the crown socket, and it is built stowed (hidden)', () => {
    expect(windModule.attachments).toContain(crownRotor);
    expect(crownRotor.socket).toBe('crown');
    const r = built();
    expect(r.visible).toBe(false);
    expect(r.deployed).toBe(0);
  });

  it('shows only while gliding: every other state keeps it hidden, grounded or airborne (incl. gust)', () => {
    // 'gust' included: a Gust in mid-glide reports 'gust' (it outranks glide in the state report),
    // so the rotor follows the state and retracts for the Gust (flagged in STATUS, WO-007).
    const others: PlayerState[] = ['idle', 'run', 'jump', 'fall', 'land', 'gust'];
    for (const state of others) {
      for (const grounded of [true, false]) {
        const r = built();
        drive(r, at(state, grounded), 1);
        expect(r.visible, `${state} grounded=${String(grounded)}`).toBe(false);
      }
    }
    const r = built();
    crownRotor.animate?.(r, DT, GLIDE);
    expect(r.visible).toBe(true); // the very first glide step
  });

  it('deploys with a scale-in over deployTime when the glide starts', () => {
    const r = built();
    const steps = Math.ceil(ROTOR.deployTime / DT - 1e-9);
    for (let i = 1; i <= steps; i += 1) {
      crownRotor.animate?.(r, DT, GLIDE);
      expect(r.visible).toBe(true);
      expect(r.scale.x).toBeCloseTo(Math.min(1, (i * DT) / ROTOR.deployTime), 9);
      expect(r.scale.y).toBe(r.scale.x); // uniform
    }
    expect(r.deployed).toBeCloseTo(1, 9);
    drive(r, GLIDE, 1);
    expect(r.deployed).toBe(1); // holds fully out (clamped) for the rest of the glide
  });

  it('retracts the same way when the glide ends in mid-air (Jump released), then hides', () => {
    const r = built();
    drive(r, GLIDE, 0.5);
    const FALL = at('fall', false);
    crownRotor.animate?.(r, DT, FALL);
    expect(r.visible).toBe(true);
    expect(r.scale.x).toBeCloseTo(1 - DT / ROTOR.deployTime, 9);
    drive(r, FALL, ROTOR.deployTime);
    expect(r.visible).toBe(false);
    expect(r.deployed).toBe(0);
  });

  it('touchdown hides it at once: a landing, or a respawn onto a checkpoint (both are glide → land here)', () => {
    for (const touchdown of [at('land', true), at('idle', true), at('run', true)]) {
      const r = built();
      drive(r, GLIDE, 0.5);
      expect(r.visible).toBe(true);
      crownRotor.animate?.(r, DT, touchdown);
      expect(r.visible).toBe(false);
      expect(r.deployed).toBe(0);
    }
  });

  it('dt = 0 (hit-stop, the card freeze) changes nothing', () => {
    const r = built();
    drive(r, GLIDE, 0.05);
    const scale = r.scale.x;
    const angle = r.spinAngle;
    crownRotor.animate?.(r, 0, GLIDE);
    crownRotor.animate?.(r, 0, at('fall', false));
    expect(r.visible).toBe(true);
    expect(r.scale.x).toBe(scale);
    expect(r.spinAngle).toBe(angle);
  });
});

describe('Crown rotor (WO-007) — frame-rate independence (CLAUDE.md rule 3)', () => {
  it('one second of glide gives the same spin angle and deploy at 30, 60, 120 and 144 Hz, and with ragged steps', () => {
    const SECONDS = 1;
    const expected = (ROTOR.spinRate * SECONDS) % TWO_PI;
    for (const hz of [30, 60, 120, 144]) {
      const r = built();
      drive(r, GLIDE, 1, 1 / hz);
      expect(r.spinAngle, `${String(hz)} Hz`).toBeCloseTo(expected, 9);
      expect(r.deployed).toBe(1);
    }
    const ragged = built();
    const pattern = [0.01, 0.03, 0.02, 0.04]; // 0.1 s, ten times
    for (let k = 0; k < 10; k += 1) for (const dt of pattern) crownRotor.animate?.(ragged, dt, GLIDE);
    expect(ragged.spinAngle).toBeCloseTo(expected, 9);
  });

  it('the deploy is time-based too: half the deploy time gives half the scale at any step size', () => {
    const half = ROTOR.deployTime / 2;
    for (const n of [3, 5, 9, 20]) {
      const r = built();
      for (let i = 0; i < n; i += 1) crownRotor.animate?.(r, half / n, GLIDE);
      expect(r.scale.x, `${String(n)} steps`).toBeCloseTo(0.5, 9);
    }
  });
});

describe('Crown rotor (WO-007) — through the real Player (the SocketRig drives it; Player.ts never names it)', () => {
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
  const rotorIn = (scene: THREE.Scene): CrownRotor | null => {
    const o = scene.getObjectByName('attachment:crown-rotor');
    return o instanceof CrownRotor ? o : null;
  };

  it('Wind puts it on socket:crown, stowed; a glide deploys it; releasing Jump retracts it; revoking Wind removes it', () => {
    const scene = new THREE.Scene();
    const player = new Player(scene, () => null);
    player.spawnAt(new THREE.Vector3(0, 200, 0));
    player.setSpawn(new THREE.Vector3(0, 0, 0)); // keep the fast-fail line far below the fall
    player.addElement(windModule);
    const rotor = rotorIn(scene);
    expect(rotor?.parent?.name).toBe('socket:crown');

    for (let i = 0; i < 60; i += 1) player.update(DT, DT, snap()); // falling, not gliding
    expect(player.state).toBe('fall');
    expect(rotor?.visible).toBe(false);

    player.update(DT, DT, snap({ jumpPressed: true, jumpHeld: true }));
    expect(player.state).toBe('glide');
    expect(rotor?.visible).toBe(true);
    for (let i = 0; i < 30; i += 1) player.update(DT, DT, snap({ jumpHeld: true }));
    expect(rotor?.deployed).toBe(1);

    player.update(DT, DT, snap()); // Jump released mid-air: the glide ends, the rotor retracts
    expect(player.state).toBe('fall');
    expect(rotor?.visible).toBe(true);
    for (let i = 0; i < Math.ceil(ROTOR.deployTime / DT); i += 1) player.update(DT, DT, snap());
    expect(rotor?.visible).toBe(false);

    player.clearElements();
    expect(rotorIn(scene)).toBeNull();
  });

  it('FLAGGED, as ordered: a Gust in mid-glide reports gust, so the rotor dips (retracts, hides, redeploys)', () => {
    // The WO's rule is "hidden unless the state is glide". Gust is listed before Glide, and the first
    // active ability's state wins the report, so a mid-glide Gust reads as 'gust' while the glide goes on.
    const scene = new THREE.Scene();
    const player = new Player(scene, () => null);
    player.spawnAt(new THREE.Vector3(0, 200, 0));
    player.setSpawn(new THREE.Vector3(0, 0, 0));
    player.addElement(windModule);
    const rotor = rotorIn(scene);
    for (let i = 0; i < 60; i += 1) player.update(DT, DT, snap());
    player.update(DT, DT, snap({ jumpPressed: true, jumpHeld: true }));
    for (let i = 0; i < 30; i += 1) player.update(DT, DT, snap({ jumpHeld: true }));
    expect(rotor?.deployed).toBe(1);

    const states: string[] = [];
    const shown: boolean[] = [];
    player.update(DT, DT, snap({ jumpHeld: true, actionPressed: true, actionHeld: true }));
    states.push(player.state);
    shown.push(rotor?.visible === true);
    for (let i = 0; i < 40; i += 1) {
      player.update(DT, DT, snap({ jumpHeld: true }));
      states.push(player.state);
      shown.push(rotor?.visible === true);
    }
    const gustSteps = states.filter((s) => s === 'gust').length;
    const hiddenSteps = shown.filter((v) => !v).length;
    const G = TUNING.wind.gust;
    expect(gustSteps).toBe(Math.ceil((G.windup + G.duration) / DT)); // 16 steps ≈ 0.27 s
    expect(states.at(-1)).toBe('glide'); // the glide never stopped
    expect(hiddenSteps).toBe(gustSteps - Math.ceil(ROTOR.deployTime / DT) + 1); // ≈ 0.13 s hidden at 0.15 s deploy
    expect(shown.at(-1)).toBe(true);
  });
});
