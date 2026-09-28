import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import type { PushEvent } from '../../core/Events';
import { DEG2RAD } from '../../core/Math';
import type { Materials } from '../../render/Materials';
import { GIZMO_COLOR, setGizmoColor, wireSphere } from '../PropGizmos';
import type { FanData } from '../PropSchema';
import type { PushBounds } from '../PushCone';
import type { Vec3Tuple } from '../SchemaUtil';
import type { Prop, PropContext } from './Prop';
import { WindZone } from './WindZone';

// Structural geometry.
const HUB_HEIGHT = 1.4;
const HOUSING: Vec3Tuple = [1.8, 1.8, 0.5];
const BLADE: Vec3Tuple = [0.25, 0.8, 0.05];
const BLADE_COUNT = 3;
const CONTINUOUS = 1; // period == duration → the current never pauses
const GIZMO_RADIUS = 0.35;

/**
 * SPEC §6.4 Fan. A push stronger than `threshold` switches it on (latched).
 * Running, it drives a CONTINUOUS WindZone out of its face (local +Z), `reach`
 * metres long — the same force/mass push as any wind zone.
 */
export class Fan implements Prop {
  readonly id: string;
  readonly gizmo: THREE.Group;
  private readonly root = new THREE.Group();
  private readonly blades = new THREE.Group();
  private readonly marker: THREE.LineSegments;
  private readonly current: WindZone;
  private running = false;

  constructor(
    private readonly data: FanData,
    private readonly scene: THREE.Scene,
    materials: Materials,
  ) {
    this.id = data.id;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(...HOUSING), materials.get('metal'));
    housing.position.y = HUB_HEIGHT;
    for (let i = 0; i < BLADE_COUNT; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(...BLADE), materials.get('pillar'));
      blade.position.y = BLADE[1] / 2;
      const arm = new THREE.Group();
      arm.rotation.z = (i / BLADE_COUNT) * Math.PI * 2;
      arm.add(blade);
      this.blades.add(arm);
    }
    this.blades.position.set(0, HUB_HEIGHT, HOUSING[2] / 2 + BLADE[2]);
    this.root.add(housing, this.blades);
    this.root.position.set(...data.pos);
    this.root.rotation.y = data.rotY * DEG2RAD;
    this.root.traverse((o) => {
      o.castShadow = true;
    });
    scene.add(this.root);

    const F = TUNING.props.fan;
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), data.rotY * DEG2RAD);
    const start = HOUSING[2] / 2 + data.reach / 2;
    this.current = new WindZone(
      {
        type: 'windZone',
        id: `${data.id}:current`,
        pos: [data.pos[0] + forward.x * start, data.pos[1], data.pos[2] + forward.z * start],
        size: [F.width, F.height, data.reach],
        rotY: data.rotY,
        dir: [forward.x, 0, forward.z],
        force: data.force,
        period: CONTINUOUS,
        duration: CONTINUOUS,
        telegraph: 0,
      },
      scene,
    );
    this.current.enabled = false;

    this.gizmo = new THREE.Group();
    this.marker = wireSphere(GIZMO_RADIUS, GIZMO_COLOR.idle);
    this.marker.position.copy(this.hub());
    this.gizmo.add(this.marker, this.current.gizmo);
  }

  private hub(): THREE.Vector3 {
    return new THREE.Vector3(this.data.pos[0], this.data.pos[1] + HUB_HEIGHT, this.data.pos[2]);
  }

  update(dt: number, ctx: PropContext): void {
    if (this.running) this.blades.rotation.z += TUNING.props.fan.bladeSpin * dt;
    this.current.update(dt, ctx);
  }

  /** Housing plus blades, in the fan's own frame (the blades sit on its +Z face). */
  pushBounds(): PushBounds {
    const [w, h, d] = HOUSING;
    this.root.updateMatrix();
    return {
      box: new THREE.Box3(
        new THREE.Vector3(-w / 2, HUB_HEIGHT - h / 2, -d / 2),
        new THREE.Vector3(w / 2, HUB_HEIGHT + h / 2, d / 2 + BLADE[2] * 1.5),
      ),
      frame: this.root.matrix.clone(),
    };
  }

  onPush(e: PushEvent): void {
    if (this.running || e.force <= this.data.threshold) return;
    this.running = true;
    this.current.enabled = true;
    setGizmoColor(this.marker, GIZMO_COLOR.done);
  }

  solid(): null {
    return null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  dispose(): void {
    this.current.dispose();
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
    });
  }
}
