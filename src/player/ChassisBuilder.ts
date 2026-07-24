import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import { SOCKET_OFFSETS, type SocketId } from './Sockets';

// SPEC §3.1 — structural chassis constants (identity, not feel; the visor may
// migrate to tuning later since the face is identity and will get fiddled with).
export const CHASSIS_BASE_COLOR = '#F2EDE4'; // tint target when the loadout empties
const BODY_COLOR = CHASSIS_BASE_COLOR;
const BODY_ROUGHNESS = 0.85;
const HEAD_RADIUS = 0.28;
const HEAD_OFFSET_Y = 0.62; // above capsule centre
const VISOR_SIZE: readonly [number, number, number] = [0.24, 0.05, 0.04];
const VISOR_COLOR = '#14161A';
const VISOR_EMISSIVE = '#1E232B';

export interface Chassis {
  /** Feet-origin root. The controller writes position/yaw here. */
  root: THREE.Object3D;
  /** Body group — ProcAnim scales/leans/bobs this, pivoted at the feet. */
  body: THREE.Object3D;
  sockets: ReadonlyMap<SocketId, THREE.Object3D>;
  /** The shared body material — element tint lerps drive its colour. */
  material: THREE.MeshStandardMaterial;
}

/**
 * The blank creature, primitives only: capsule + head sphere + visor slit.
 * No arms, no legs — deliberate (SPEC §3.1). Forward is local +Z.
 * All ten M3 socket anchors exist now, empty.
 */
export function buildChassis(): Chassis {
  const { radius, height } = TUNING.player;
  const root = new THREE.Object3D();
  root.name = 'player';
  const body = new THREE.Object3D();
  body.name = 'player:body';
  root.add(body);

  const material = new THREE.MeshStandardMaterial({
    color: BODY_COLOR,
    roughness: BODY_ROUGHNESS,
    metalness: 0,
  });

  const capsuleCentreY = height / 2;
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, height - 2 * radius),
    material,
  );
  capsule.position.y = capsuleCentreY;
  capsule.castShadow = true;
  body.add(capsule);

  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_RADIUS), material);
  head.position.y = capsuleCentreY + HEAD_OFFSET_Y;
  head.castShadow = true;
  body.add(head);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(...VISOR_SIZE),
    new THREE.MeshStandardMaterial({
      color: VISOR_COLOR,
      emissive: VISOR_EMISSIVE,
      roughness: 0.4,
      metalness: 0,
    }),
  );
  visor.position.set(0, head.position.y, HEAD_RADIUS * 0.88);
  body.add(visor);

  const sockets = new Map<SocketId, THREE.Object3D>();
  for (const [id, offset] of Object.entries(SOCKET_OFFSETS) as [
    SocketId,
    readonly [number, number, number],
  ][]) {
    const socket = new THREE.Object3D();
    socket.name = `socket:${id}`;
    socket.position.set(...offset);
    body.add(socket);
    sockets.set(id, socket);
  }

  return { root, body, sockets, material };
}
