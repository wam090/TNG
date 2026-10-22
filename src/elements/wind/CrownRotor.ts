import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import type { AttachmentSpec, PlayerRuntimeState } from '../ElementModule';

// Shape of the placeholder rotor, as fractions of TUNING.wind.rotor.radius: structural
// proportions (like the chassis'), not tunables. The size itself is the tuning value.
const DISC_THICKNESS = 0.04;
const DISC_SEGMENTS = 40;
const BLADE_LENGTH = 0.96; // from the centre, so the tips sit just inside the disc's rim
const BLADE_WIDTH = 0.26;
const BLADE_THICKNESS = 0.08;
const HUB_RADIUS = 0.14;
const HUB_SEGMENTS = 12;
// The mast runs from the disc down this far below the crown socket, into the head, so the
// rotor reads as attached rather than floating (the socket sits 0.07 m above the head).
const MAST_DROP = 0.12;
const ROUGHNESS = 0.6;
const TWO_PI = Math.PI * 2;

/**
 * Wind's crown rotor (SPEC §3.3), pulled forward from M5 by the CEO (WO-007): a thin
 * pale disc with dark blades on the crown socket, primitives only. It shows only while
 * the player's state is 'glide'. It scales in over `deployTime` when the glide starts,
 * scales back out when the glide ends in mid-air, and spins at `spinRate × dt` while
 * shown. Touchdown hides it at once: from here a landing and a respawn onto a checkpoint
 * look the same (glide → land), and after a respawn it must never show.
 * The Player never knows it exists — the SocketRig calls animate() with the runtime state.
 */
export class CrownRotor extends THREE.Group {
  private deploy = 0; // 0 stowed (hidden) … 1 fully out
  private readonly spinner = new THREE.Group();

  constructor() {
    super();
    const R = TUNING.wind.rotor;
    this.name = 'attachment:crown-rotor';
    this.spinner.name = 'crown-rotor:spinner';
    this.spinner.position.y = R.lift;
    this.add(this.spinner);

    const dark = new THREE.MeshStandardMaterial({ color: R.bladeColor, roughness: ROUGHNESS, metalness: 0 });
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(R.radius, R.radius, R.radius * DISC_THICKNESS, DISC_SEGMENTS),
      new THREE.MeshStandardMaterial({
        color: R.discColor,
        roughness: ROUGHNESS,
        metalness: 0,
        transparent: true,
        opacity: R.discOpacity,
        depthWrite: false,
      }),
    );
    this.spinner.add(disc);

    const length = R.radius * BLADE_LENGTH;
    const thickness = R.radius * BLADE_THICKNESS;
    for (let i = 0; i < R.blades; i += 1) {
      const geometry = new THREE.BoxGeometry(length, thickness, R.radius * BLADE_WIDTH);
      geometry.translate(length / 2, thickness / 2, 0); // root at the hub, resting on the disc
      const blade = new THREE.Mesh(geometry, dark);
      blade.rotation.y = (i / R.blades) * TWO_PI;
      this.spinner.add(blade);
    }

    const mastHeight = R.lift + MAST_DROP + thickness;
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(R.radius * HUB_RADIUS, R.radius * HUB_RADIUS, mastHeight, HUB_SEGMENTS),
      dark,
    );
    mast.position.y = R.lift + thickness - mastHeight / 2; // from just above the blades down into the head
    this.add(mast);

    this.visible = false;
  }

  /** One sim step on world time. dt = 0 (hit-stop, the card's freeze) changes nothing. */
  step(dt: number, s: PlayerRuntimeState): void {
    const R = TUNING.wind.rotor;
    const rate = dt / R.deployTime;
    if (s.state === 'glide') this.deploy = Math.min(1, this.deploy + rate);
    else if (s.grounded) this.deploy = 0; // touchdown: a landing, or a respawn onto a checkpoint
    else this.deploy = Math.max(0, this.deploy - rate); // the glide ended in mid-air: retract
    this.visible = this.deploy > 0;
    if (!this.visible) return;
    this.scale.setScalar(this.deploy);
    this.spinner.rotation.y = (this.spinner.rotation.y + R.spinRate * dt) % TWO_PI;
  }

  /** 0 stowed … 1 fully out (tests). */
  get deployed(): number {
    return this.deploy;
  }

  /** The blades' angle about the crown, radians in [0, 2π) (tests). */
  get spinAngle(): number {
    return this.spinner.rotation.y;
  }
}

/** The AttachmentSpec Wind bolts onto the crown socket. */
export const crownRotor: AttachmentSpec = {
  socket: 'crown',
  build: () => new CrownRotor(),
  animate: (obj, dt, s) => {
    if (obj instanceof CrownRotor) obj.step(dt, s);
  },
};
