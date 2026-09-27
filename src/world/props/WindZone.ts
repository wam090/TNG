import * as THREE from 'three';
import { DEG2RAD } from '../../core/Math';
import { arrow, GIZMO_COLOR, setGizmoColor, wireBox } from '../PropGizmos';
import type { WindZoneData } from '../PropSchema';
import { bodyCentre, type Prop, type PropContext } from './Prop';
import { Volume } from './Volume';

// Placeholder feedback so the VP can read the pulse while playtesting — the
// real telegraph/gust VFX is M5. Opacity per phase: calm / telegraph / gust.
const HAZE_COLOR = '#FFFFFF';
const HAZE_OPACITY = { calm: 0, telegraph: 0.07, gust: 0.16 } as const;
const GIZMO_ARROW_LENGTH = 2;

export type ZonePhase = 'calm' | 'telegraph' | 'gust';

/**
 * SPEC §6.4 WindZone: a trigger volume that pushes whatever is inside it with
 * a horizontal FORCE along `dir` (the controller divides by mass — the zone
 * never knows it). Pulses on a timer: each `period`, `telegraph` seconds of
 * warning, then `duration` seconds of gust, the rest calm. A zone with
 * duration == period (and no telegraph) blows continuously — that is how a
 * Fan's current is built. Can be switched off (a fan that is not running).
 */
export class WindZone implements Prop {
  readonly id: string;
  readonly gizmo: THREE.Group;
  enabled = true;
  private readonly volume: Volume;
  private readonly push = new THREE.Vector3();
  private readonly haze: THREE.Mesh;
  private readonly box: THREE.LineSegments;
  private t = 0;

  constructor(
    private readonly data: WindZoneData,
    private readonly scene: THREE.Scene,
  ) {
    this.id = data.id;
    this.volume = new Volume(data.pos, data.size, data.rotY);
    this.push.set(...data.dir).normalize().multiplyScalar(data.force);

    this.haze = new THREE.Mesh(
      new THREE.BoxGeometry(...data.size),
      new THREE.MeshBasicMaterial({ color: HAZE_COLOR, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.haze.position.set(data.pos[0], data.pos[1] + data.size[1] / 2, data.pos[2]);
    this.haze.rotation.y = data.rotY * DEG2RAD;
    scene.add(this.haze);

    this.gizmo = new THREE.Group();
    this.box = wireBox(data.size, GIZMO_COLOR.volume);
    this.box.position.set(...data.pos);
    this.box.rotation.y = data.rotY * DEG2RAD;
    const pointer = arrow(this.push, GIZMO_ARROW_LENGTH, GIZMO_COLOR.active);
    pointer.position.set(data.pos[0], data.pos[1] + data.size[1] / 2, data.pos[2]);
    this.gizmo.add(this.box, pointer);
  }

  /** Where in its cycle the zone is. Gust = the LAST `duration` of each period. */
  get phase(): ZonePhase {
    if (!this.enabled) return 'calm';
    const { period, duration, telegraph } = this.data;
    const p = this.t % period;
    if (p >= period - duration) return 'gust';
    if (p >= period - duration - telegraph) return 'telegraph';
    return 'calm';
  }

  update(dt: number, ctx: PropContext): void {
    this.t += dt;
    const phase = this.phase;
    (this.haze.material as THREE.MeshBasicMaterial).opacity = HAZE_OPACITY[phase];
    this.haze.visible = phase !== 'calm';
    if (phase === 'gust' && this.volume.contains(bodyCentre(ctx.player))) ctx.player.applyForce(this.push);
    setGizmoColor(this.box, phase === 'gust' ? GIZMO_COLOR.active : phase === 'telegraph' ? GIZMO_COLOR.idle : GIZMO_COLOR.volume);
  }

  pushTarget(): null {
    return null;
  }

  onPush(): void {
    // Wind is not pushed by wind.
  }

  solid(): null {
    return null;
  }

  dispose(): void {
    this.scene.remove(this.haze);
    this.haze.geometry.dispose();
    (this.haze.material as THREE.Material).dispose();
  }
}
