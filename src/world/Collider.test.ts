import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Materials } from '../render/Materials';
import { LevelBuilder } from './LevelBuilder';
import { parseLevel } from './LevelSchema';

// End-to-end through the real pipeline: JSON → parse → build → merged BVH.
const json = {
  id: 'collider-test',
  spawn: [0, 2, 0],
  blocks: [
    { type: 'box', pos: [0, -0.5, 0], size: [30, 1, 24], mat: 'stone' },
    // Wedge rising along +Z: y=0 at z=-3 up to y=2 at z=+3, centred at x=8.
    { type: 'ramp', pos: [8, 1, 0], size: [4, 2, 6], rotY: 0, mat: 'stone' },
  ],
};

const build = () => new LevelBuilder(new Materials()).build(parseLevel(json), new THREE.Scene());

describe('Collider', () => {
  it('ground-probes the floor top', () => {
    const { collider } = build();
    const hit = collider.groundProbe(new THREE.Vector3(0, 5, 0));
    expect(hit).not.toBeNull();
    expect(hit?.point.y).toBeCloseTo(0, 5);
    expect(hit?.normal.y).toBeCloseTo(1, 5);
    expect(hit?.distance).toBeCloseTo(5, 5);
  });

  it('ground-probes the ramp slope at the expected height (wedge orientation proof)', () => {
    const { collider } = build();
    // Middle of the ramp footprint (z=0) → slope should be at half height, y=1.
    const mid = collider.groundProbe(new THREE.Vector3(8, 5, 0));
    expect(mid?.point.y).toBeCloseTo(1, 5);
    // Three-quarters up (z=+1.5) → y=1.5.
    const upper = collider.groundProbe(new THREE.Vector3(8, 5, 1.5));
    expect(upper?.point.y).toBeCloseTo(1.5, 5);
  });

  it('returns null on a miss', () => {
    const { collider } = build();
    expect(collider.groundProbe(new THREE.Vector3(100, 5, 100))).toBeNull();
  });

  it('respects maxDistance', () => {
    const { collider } = build();
    expect(collider.groundProbe(new THREE.Vector3(0, 5, 0), 2)).toBeNull();
  });

  it('capsuleSweep is a loud M2 stub', () => {
    const { collider } = build();
    expect(() =>
      collider.capsuleSweep(new THREE.Vector3(), new THREE.Vector3(), 0.35, 1.3),
    ).toThrow(/M2/);
  });
});
