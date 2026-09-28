import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import type { PushEvent } from '../../core/Events';
import { DEG2RAD } from '../../core/Math';
import type { Materials } from '../../render/Materials';
import { GIZMO_COLOR, setGizmoColor, wireSphere } from '../PropGizmos';
import type { WindmillData } from '../PropSchema';
import type { PushBounds } from '../PushCone';
import { solidBox, type Prop, type PropContext } from './Prop';

// Structural geometry (like chassis proportions) — not feel tunables.
const HUB_HEIGHT = 2.4;
const TOWER_SIZE: [number, number, number] = [0.35, HUB_HEIGHT, 0.35];
const HUB_RADIUS = 0.22;
const BLADE_SIZE: [number, number, number] = [0.28, 1.4, 0.06];
const BLADE_COUNT = 4;
const ROTOR_OFFSET = 0.3; // rotor sits in front of the tower, along local +Z
const FULL_TURN = Math.PI * 2;
const GIZMO_RADIUS = 0.35;
// Drive shaft (visual only, WO-004 D2): a square rod with collars so its turning reads.
const SHAFT_HEIGHT = 0.3; // above the windmill's base
const SHAFT_ROD = 0.14;
const SHAFT_COLLAR: [number, number, number] = [0.3, 0.3, 0.12];
const SHAFT_COLLAR_SPACING = 1.2;

/**
 * SPEC §6.4 Windmill. A push stronger than `threshold` adds spin (force ×
 * spinPerForce, rad/s); spin decays (torqueDecay kept per second). Once it
 * completes one FULL turn while at or above activateAt, it emits its signal
 * (latched). It knows it got pushed; it never knows what pushed it.
 */
export class Windmill implements Prop {
  readonly id: string;
  readonly gizmo: THREE.Group;
  private readonly root = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly marker: THREE.LineSegments;
  private omega = 0; // rad/s
  private angle = 0; // visual rotor angle
  private turnAtSpeed = 0; // radians turned while omega >= activateAt
  private emitted = false;
  private readonly towerSolid: THREE.BufferGeometry;
  private readonly shaft: THREE.Group | null = null;
  private readonly shaftSpin = new THREE.Group();

  constructor(
    private readonly data: WindmillData,
    private readonly scene: THREE.Scene,
    materials: Materials,
  ) {
    this.id = data.id;
    const metal = materials.get('metal');
    const tower = new THREE.Mesh(new THREE.BoxGeometry(...TOWER_SIZE), metal);
    tower.position.y = HUB_HEIGHT / 2;
    const hub = new THREE.Mesh(new THREE.SphereGeometry(HUB_RADIUS), metal);
    this.rotor.add(hub);
    for (let i = 0; i < BLADE_COUNT; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(...BLADE_SIZE), materials.get('pillar'));
      blade.position.y = BLADE_SIZE[1] / 2;
      const arm = new THREE.Group();
      arm.rotation.z = (i / BLADE_COUNT) * FULL_TURN;
      arm.add(blade);
      this.rotor.add(arm);
    }
    this.rotor.position.set(0, HUB_HEIGHT, ROTOR_OFFSET);
    this.root.add(tower, this.rotor);
    this.root.position.set(...data.pos);
    this.root.rotation.y = data.rotY * DEG2RAD;
    this.root.traverse((o) => {
      o.castShadow = true;
    });
    scene.add(this.root);
    this.towerSolid = solidBox(TOWER_SIZE, [0, HUB_HEIGHT / 2, 0], this.rootMatrix());
    if (data.shaftTo) {
      this.shaft = this.buildShaft(data.shaftTo, materials);
      scene.add(this.shaft);
    }

    this.gizmo = new THREE.Group();
    this.marker = wireSphere(GIZMO_RADIUS, GIZMO_COLOR.idle);
    this.gizmo.add(this.marker);
    this.gizmo.position.copy(this.hubWorld());
  }

  /** A rod from the base to `to`, spinning about its own axis (shaftSpin) with the rotor. */
  private buildShaft(to: [number, number, number], materials: Materials): THREE.Group {
    const from = new THREE.Vector3(this.data.pos[0], this.data.pos[1] + SHAFT_HEIGHT, this.data.pos[2]);
    const span = new THREE.Vector3(...to).sub(from);
    const length = span.length();
    const shaft = new THREE.Group();
    shaft.name = `shaft:${this.data.id}`;
    shaft.position.copy(from);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), span.clone().normalize());
    const metal = materials.get('metal');
    const rod = new THREE.Mesh(new THREE.BoxGeometry(SHAFT_ROD, SHAFT_ROD, length), metal);
    rod.position.z = length / 2;
    this.shaftSpin.add(rod);
    const collars = Math.max(1, Math.floor(length / SHAFT_COLLAR_SPACING));
    for (let i = 1; i <= collars; i += 1) {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(...SHAFT_COLLAR), metal);
      collar.position.z = (length * i) / (collars + 1);
      this.shaftSpin.add(collar);
    }
    shaft.add(this.shaftSpin);
    shaft.traverse((o) => {
      o.castShadow = true;
    });
    return shaft;
  }

  private hubWorld(): THREE.Vector3 {
    return new THREE.Vector3(0, HUB_HEIGHT, ROTOR_OFFSET).applyMatrix4(this.rootMatrix());
  }

  private rootMatrix(): THREE.Matrix4 {
    this.root.updateMatrix();
    return this.root.matrix;
  }

  update(dt: number, ctx: PropContext): void {
    const W = TUNING.props.windmill;
    this.omega *= Math.pow(W.torqueDecay, dt);
    const turned = this.omega * dt;
    this.angle = (this.angle + turned) % FULL_TURN;
    this.rotor.rotation.z = this.angle;
    this.shaftSpin.rotation.z = this.angle; // the shaft turns with the rotor
    this.turnAtSpeed = this.omega >= W.activateAt ? this.turnAtSpeed + turned : 0;
    if (!this.emitted && this.turnAtSpeed >= FULL_TURN) {
      this.emitted = true;
      if (this.data.emits) ctx.signals.emit(this.data.emits);
    }
    const atSpeed = this.omega >= W.activateAt;
    setGizmoColor(this.marker, this.emitted ? GIZMO_COLOR.done : atSpeed ? GIZMO_COLOR.active : GIZMO_COLOR.idle);
  }

  /** The whole machine — tower and rotor disc — in the windmill's own frame. */
  pushBounds(): PushBounds {
    const reach = BLADE_SIZE[1];
    return {
      box: new THREE.Box3(
        new THREE.Vector3(-reach, 0, -TOWER_SIZE[2] / 2),
        new THREE.Vector3(reach, HUB_HEIGHT + reach, ROTOR_OFFSET + HUB_RADIUS),
      ),
      frame: this.rootMatrix().clone(),
    };
  }

  onPush(e: PushEvent): void {
    if (e.force > this.data.threshold) this.omega += e.force * TUNING.props.windmill.spinPerForce;
  }

  solid(): THREE.BufferGeometry {
    return this.towerSolid;
  }

  get spin(): number {
    return this.omega;
  }

  get hasEmitted(): boolean {
    return this.emitted;
  }

  dispose(): void {
    this.towerSolid.dispose();
    if (this.shaft) {
      this.scene.remove(this.shaft);
      this.shaft.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
      });
    }
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
    });
  }
}
