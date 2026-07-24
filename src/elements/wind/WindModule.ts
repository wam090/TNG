import * as THREE from 'three';
import { TUNING } from '../../config/tuning';
import type { AttachmentSpec, ElementModule, ElementVfx } from '../ElementModule';

// ─────────────────────────────────────────────────────────────────────────────
// TEST FIXTURE — this ring exists ONLY to prove the socket pipeline attaches,
// follows, animates and detaches. It is NOT art and it is NOT the Wind visual
// (that's M5: streaks, motes, crown rotor). If it looks good, that's an
// accident. Replace wholesale at M5.
// ─────────────────────────────────────────────────────────────────────────────
const FIXTURE_RING_RADIUS = 0.55;
const FIXTURE_RING_TUBE = 0.02;
const FIXTURE_RING_TILT = 1.25; // radians off flat, so the spin reads
const FIXTURE_RING_SPIN = 1.2; // rad/s

const testFixtureRing: AttachmentSpec = {
  socket: 'orbitHigh',
  build: () => {
    const group = new THREE.Group();
    group.name = 'attachment:test-fixture-ring';
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(FIXTURE_RING_RADIUS, FIXTURE_RING_TUBE),
      new THREE.MeshStandardMaterial({ color: TUNING.wind.tint, roughness: 0.6, metalness: 0 }),
    );
    ring.rotation.x = FIXTURE_RING_TILT;
    group.add(ring);
    return group;
  },
  animate: (obj, dt) => {
    obj.rotation.y += FIXTURE_RING_SPIN * dt;
  },
};

const noopVfx: ElementVfx = {
  update: () => undefined,
  dispose: () => undefined,
};

/** Wind, M3 stub: tint + stat overrides + tags only. Abilities are M4, visuals are M5. */
export const windModule: ElementModule = {
  id: 'wind',
  displayName: 'Wind Core',
  bodyTint: TUNING.wind.tint,
  tags: ['light', 'air'],
  statMods: { ...TUNING.wind.statMods },
  attachments: [testFixtureRing],
  abilities: [],
  vfx: () => noopVfx,
};
