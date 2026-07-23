import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../config/tuning';
import { Materials } from '../render/Materials';
import { LevelBuilder } from '../world/LevelBuilder';
import { parseLevel } from '../world/LevelSchema';
import { CharacterController, type MoveIntent } from './CharacterController';
import { inputToWorld } from './Player';

// Floor, a THIN platform (the tunnelling arbiter), a 45° walkable wedge,
// a 63° too-steep wedge, and a raised ledge for the coyote test.
const json = {
  id: 'controller-test',
  spawn: [0, 2, 0],
  blocks: [
    { type: 'box', pos: [0, -0.5, 0], size: [120, 1, 60], mat: 'stone' },
    { type: 'box', pos: [20, 6, 0], size: [4, 0.1, 4], mat: 'stone' }, // top at 6.05
    { type: 'ramp', pos: [-20, 2, 0], size: [4, 4, 4], mat: 'stone' }, // 45° < 48°
    { type: 'ramp', pos: [-30, 4, 0], size: [4, 8, 4], mat: 'stone' }, // 63.4° > 48°
    { type: 'box', pos: [40, 2, 0], size: [4, 4, 4], mat: 'stone' }, // ledge top at 4
    { type: 'ramp', pos: [-50, 4, 0], size: [8, 8, 8], mat: 'stone' }, // big 45° face for sustained climbs
  ],
};

const built = new LevelBuilder(new Materials()).build(parseLevel(json), new THREE.Scene());
const collider = built.collider;
const DT = TUNING.loop.fixedDt;
const stats = () => ({ ...TUNING.player.baseStats });

const IDLE: MoveIntent = { x: 0, z: 0, jumpPressed: false, jumpHeld: false };

function makeController(feet: [number, number, number]): CharacterController {
  const ctrl = new CharacterController(() => collider);
  ctrl.teleport(new THREE.Vector3(...feet));
  return ctrl;
}

function run(
  ctrl: CharacterController,
  steps: number,
  intentAt: (i: number) => MoveIntent = () => IDLE,
  onStep?: (i: number) => void,
): void {
  const s = stats();
  for (let i = 0; i < steps; i += 1) {
    ctrl.update(DT, intentAt(i), s);
    onStep?.(i);
  }
}

describe('grounding', () => {
  it('falls and settles on the floor', () => {
    const ctrl = makeController([0, 5, 0]);
    run(ctrl, 180);
    expect(ctrl.grounded).toBe(true);
    expect(ctrl.position.y).toBeCloseTo(0, 3);
  });

  it('stands on a 45° slope (under the 48° limit)', () => {
    const ctrl = makeController([-20, 2.6, 0]);
    run(ctrl, 120);
    expect(ctrl.grounded).toBe(true);
  });

  it('slides on a 63° slope (over the limit), never grounding on the face', () => {
    const ctrl = makeController([-30, 4.6, 0]);
    const startZ = 0;
    let groundedOnFace = false;
    run(ctrl, 30, () => IDLE, () => {
      if (ctrl.grounded && ctrl.position.y > 1) groundedOnFace = true;
    });
    expect(groundedOnFace).toBe(false);
    expect(ctrl.position.z).toBeLessThan(startZ - 0.2); // slid downhill (-z)
  });
});

describe('slope jump — THE ARBITER for the VP ramp-jump bug', () => {
  // Big wedge at [-50,4,0] size 8: face rises +z, surface y = z + 8 for z ∈ [-4, 4].
  const surfaceY = (z: number): number => z + 8 - 4; // z+4

  it('grounded stays CONTINUOUSLY true while climbing a walkable slope (the continuity assertion)', () => {
    const ctrl = makeController([-50, 4.1, 0]);
    run(ctrl, 30); // settle mid-face
    expect(ctrl.grounded).toBe(true);
    const startZ = ctrl.position.z;
    run(ctrl, 30, () => ({ x: 0, z: 1, jumpPressed: false, jumpHeld: false }), () => {
      expect(ctrl.grounded).toBe(true); // every single step — no flicker, no lottery
    });
    // Actually climbed. (45° climbs are slow by design — grounding zeroes the
    // slide's up-slope vy each step; the level's real 18° ramp climbs at
    // near-full speed. Flagged to the VP as a feel observation.)
    expect(ctrl.position.z).toBeGreaterThan(startZ + 0.15);
  });

  it('jump fires at full impulse mid-climb (up-slope) and the capsule leaves the face', () => {
    const ctrl = makeController([-50, 4.1, 0]);
    run(ctrl, 30);
    run(ctrl, 20, () => ({ x: 0, z: 1, jumpPressed: false, jumpHeld: false }));
    ctrl.update(DT, { x: 0, z: 1, jumpPressed: true, jumpHeld: true }, stats());
    expect(ctrl.velocity.y).toBeGreaterThan(9);
    let clearance = 0;
    run(ctrl, 8, () => ({ x: 0, z: 1, jumpPressed: false, jumpHeld: true }), () => {
      clearance = Math.max(clearance, ctrl.position.y - surfaceY(ctrl.position.z));
    });
    expect(clearance).toBeGreaterThan(0.3); // airborne above the face, not re-glued
  });

  it('jump fires while moving ALONG the slope', () => {
    const ctrl = makeController([-50, 4.1, 0]);
    run(ctrl, 30);
    run(ctrl, 12, () => ({ x: 1, z: 0, jumpPressed: false, jumpHeld: false }));
    expect(ctrl.grounded).toBe(true);
    ctrl.update(DT, { x: 1, z: 0, jumpPressed: true, jumpHeld: true }, stats());
    expect(ctrl.velocity.y).toBeGreaterThan(9);
  });

  it('coyote works after walking off a slope edge, exactly as from flat ground', () => {
    // Walking DOWN a slope stays grounded (snap working as designed), so the
    // airborne case is walking off the wedge's SIDE edge (+x, face ends at -46).
    const ctrl = makeController([-50, 4.1, 0]);
    run(ctrl, 30);
    let leftGroundAt = -1;
    let sawImpulse = false;
    run(
      ctrl,
      150,
      (i) => {
        const press = leftGroundAt >= 0 && i === leftGroundAt + 5; // 0.083s < 0.10 coyote
        return { x: 1, z: 0, jumpPressed: press, jumpHeld: press };
      },
      (i) => {
        if (leftGroundAt < 0 && !ctrl.grounded) leftGroundAt = i;
        if (leftGroundAt >= 0 && i <= leftGroundAt + 7 && ctrl.velocity.y > 9) sawImpulse = true;
      },
    );
    expect(leftGroundAt).toBeGreaterThan(0);
    expect(sawImpulse).toBe(true);
  });
});

describe('tunnelling — THE ARBITER (owner veto: test, not assertion)', () => {
  it('at max fall speed, lands ON a 0.1-thick platform, never through it', () => {
    const ctrl = makeController([20, 9, 0]);
    ctrl.velocity.set(0, -TUNING.player.baseStats.maxFallSpeed, 0);
    let minY = Infinity;
    run(ctrl, 120, () => IDLE, () => {
      minY = Math.min(minY, ctrl.position.y);
    });
    expect(ctrl.grounded).toBe(true);
    expect(ctrl.position.y).toBeCloseTo(6.05, 2);
    expect(minY).toBeGreaterThan(5.9); // never dipped through
  });

  it('raw capsuleSweep survives ~2× beyond max fall speed (M4 launch envelope)', () => {
    // 1.0 m in a single sweep call = 60 m/s at fixed dt.
    const result = collider.capsuleSweep(
      new THREE.Vector3(20, 6.5, 0),
      new THREE.Vector3(20, 5.5, 0),
      TUNING.player.radius,
      TUNING.player.height,
    );
    expect(result.collided).toBe(true);
    expect(result.position.y).toBeGreaterThanOrEqual(6.0);
  });
});

describe('jump feel (owner correction: full-hold == h, early release strictly less)', () => {
  const apexOf = (holdSteps: number): number => {
    const ctrl = makeController([0, 2, 0]);
    run(ctrl, 60); // settle on floor
    let apex = -Infinity;
    run(
      ctrl,
      120,
      (i) => ({ x: 0, z: 0, jumpPressed: i === 0, jumpHeld: i < holdSteps }),
      () => {
        apex = Math.max(apex, ctrl.position.y);
      },
    );
    return apex;
  };

  it('full-hold apex equals jumpHeight (within the semi-implicit Euler undershoot ~v·dt/2)', () => {
    const apex = apexOf(60);
    expect(apex).toBeGreaterThan(TUNING.player.baseStats.jumpHeight - 0.12);
    expect(apex).toBeLessThanOrEqual(TUNING.player.baseStats.jumpHeight + 0.01);
  });

  it('early release is strictly and substantially lower — the variable-height proof', () => {
    const full = apexOf(60);
    const early = apexOf(2);
    expect(early).toBeLessThan(full - 0.5);
    expect(early).toBeLessThan(TUNING.player.baseStats.jumpHeight * 0.7);
  });
});

describe('coyote time', () => {
  const walkOffAndJumpAfter = (stepsAfterLeavingGround: number) => {
    const ctrl = makeController([41.5, 4, 0]);
    run(ctrl, 30); // settle on the ledge
    let leftGroundAt = -1;
    let jumpedVy = 0;
    run(
      ctrl,
      120,
      (i) => {
        const press = leftGroundAt >= 0 && i === leftGroundAt + stepsAfterLeavingGround;
        return { x: 1, z: 0, jumpPressed: press, jumpHeld: press };
      },
      (i) => {
        if (leftGroundAt < 0 && !ctrl.grounded) leftGroundAt = i;
        if (leftGroundAt >= 0 && i <= leftGroundAt + stepsAfterLeavingGround + 2) {
          jumpedVy = Math.max(jumpedVy, ctrl.velocity.y);
        }
      },
    );
    return jumpedVy;
  };

  it('jump 5 steps (0.083s) after walking off still fires', () => {
    expect(walkOffAndJumpAfter(5)).toBeGreaterThan(5);
  });

  it('jump 8 steps (0.133s) after walking off does not fire mid-air', () => {
    // A real jump sets vy ≈ 10; small positive blips from ledge-corner
    // ejection are not jumps. The 5-step case above asserts > 5.
    expect(walkOffAndJumpAfter(8)).toBeLessThan(5);
  });
});

describe('jump buffer', () => {
  it('a press ~0.1s before landing jumps on the landing frame', () => {
    // First: find the landing step for this drop.
    const probe = makeController([0, 3, 0]);
    let landing = -1;
    run(probe, 120, () => IDLE, (i) => {
      if (landing < 0 && probe.grounded) landing = i;
    });
    expect(landing).toBeGreaterThan(5);

    const ctrl = makeController([0, 3, 0]);
    const pressAt = landing - 6; // 0.1s early, inside the 0.12s buffer
    let vyAfterLanding = -Infinity;
    run(
      ctrl,
      landing + 10,
      (i) => ({ x: 0, z: 0, jumpPressed: i === pressAt, jumpHeld: true }),
      (i) => {
        if (i >= landing) vyAfterLanding = Math.max(vyAfterLanding, ctrl.velocity.y);
      },
    );
    expect(vyAfterLanding).toBeGreaterThan(5);
  });
});

describe('determinism', () => {
  it('two identical runs produce bit-identical traces', () => {
    const script = (i: number): MoveIntent => ({
      x: i < 100 ? 1 : 0,
      z: i > 50 && i < 150 ? -0.5 : 0,
      jumpPressed: i === 40 || i === 90,
      jumpHeld: (i >= 40 && i < 55) || (i >= 90 && i < 93),
    });
    const trace = (): number[] => {
      const ctrl = makeController([0, 2, 0]);
      const out: number[] = [];
      run(ctrl, 200, script, () => {
        out.push(ctrl.position.x, ctrl.position.y, ctrl.position.z);
      });
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});

describe('mass (SPEC §2.2 — the one force path)', () => {
  it('acceleration from applyForce scales as 1/mass', () => {
    const noCollider = (): CharacterController => {
      const c = new CharacterController(() => null);
      c.teleport(new THREE.Vector3(0, 50, 0));
      return c;
    };
    const light = noCollider();
    const heavy = noCollider();
    const lightStats = { ...TUNING.player.baseStats, mass: 1 };
    const heavyStats = { ...TUNING.player.baseStats, mass: 2 };
    for (let i = 0; i < 60; i += 1) {
      light.applyForce(new THREE.Vector3(10, 0, 0));
      heavy.applyForce(new THREE.Vector3(10, 0, 0));
      light.update(DT, IDLE, lightStats);
      heavy.update(DT, IDLE, heavyStats);
    }
    expect(light.velocity.x).toBeGreaterThan(0);
    expect(light.velocity.x / heavy.velocity.x).toBeCloseTo(2, 3);
  });
});

describe('camera-relative input (SPEC §4.2)', () => {
  it('W (up-screen) maps to world (-√½, -√½) under the fixed 45° yaw', () => {
    const w = inputToWorld(0, -1);
    expect(w.x).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(w.z).toBeCloseTo(-Math.SQRT1_2, 10);
  });

  it('D (right-screen) maps to world (+√½, -√½)', () => {
    const d = inputToWorld(1, 0);
    expect(d.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(d.z).toBeCloseTo(-Math.SQRT1_2, 10);
  });
});
