import * as THREE from 'three';
import { TUNING } from '../config/tuning';
import { DEG2RAD } from '../core/Math';
import type { Collider } from '../world/Collider';
import type { PlayerStats } from './PlayerStats';

export interface MoveIntent {
  /** World-space horizontal move direction × magnitude, length <= 1. */
  x: number;
  z: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface ControllerEvents {
  jumped: boolean;
  landed: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
// Ground probe starts at the bottom-sphere centre so it can't start under the floor.
const GROUND_PROBE_EXTRA = 0.02; // small skin beyond snap distance

/**
 * Kinematic capsule character. No physics engine (SPEC §8.3): velocity is
 * integrated semi-implicitly at fixed dt, the capsule is swept against the
 * BVH with sliding, and grounding comes from a downward probe with snap.
 * Fully deterministic — same inputs, same trace, every run.
 */
export class CharacterController {
  readonly position = new THREE.Vector3(); // feet
  readonly velocity = new THREE.Vector3();
  grounded = false;
  readonly groundNormal = new THREE.Vector3(0, 1, 0);

  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpActive = false; // variable-height window: rising from a jump
  private snapSuppressTimer = 0; // post-jump window where ground-snap cannot recapture
  private readonly force = new THREE.Vector3(); // external force accumulator

  constructor(private readonly getCollider: () => Collider | null) {}

  teleport(feet: THREE.Vector3): void {
    this.position.copy(feet);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.jumpActive = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.snapSuppressTimer = 0;
  }

  /** The one force-application path. Force ÷ mass = acceleration (SPEC §2.2). */
  applyForce(force: THREE.Vector3): void {
    this.force.add(force);
  }

  update(dt: number, intent: MoveIntent, stats: PlayerStats): ControllerEvents {
    const events: ControllerEvents = { jumped: false, landed: false };
    const collider = this.getCollider();

    // --- timers ---
    if (intent.jumpPressed) this.jumpBufferTimer = TUNING.player.jumpBuffer;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (!this.grounded) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.snapSuppressTimer = Math.max(0, this.snapSuppressTimer - dt);

    // --- horizontal: accelerate toward target velocity ---
    const targetX = intent.x * stats.moveSpeed;
    const targetZ = intent.z * stats.moveSpeed;
    const hasInput = intent.x !== 0 || intent.z !== 0;
    const accel = this.grounded ? stats.accelGround : stats.accelAir * stats.airControl;
    const maxStep = accel * dt;
    const dx = targetX - this.velocity.x;
    const dz = targetZ - this.velocity.z;
    const dLen = Math.hypot(dx, dz);
    if (dLen > 0) {
      const scale = Math.min(1, maxStep / dLen);
      this.velocity.x += dx * scale;
      this.velocity.z += dz * scale;
    }
    if (this.grounded && !hasInput) {
      const keep = Math.max(0, 1 - stats.friction * dt);
      this.velocity.x *= keep;
      this.velocity.z *= keep;
    }

    // --- jump (buffered, with coyote) — BEFORE gravity, so the impulse
    // integrates semi-implicitly and full-hold apex lands just under
    // jumpHeight (undershoot ~v·dt/2) instead of overshooting it ---
    if (this.jumpBufferTimer > 0 && (this.grounded || this.coyoteTimer > 0)) {
      this.velocity.y = Math.sqrt(2 * stats.gravity * stats.jumpHeight);
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.jumpActive = true;
      this.snapSuppressTimer = TUNING.player.jumpSnapSuppress;
      events.jumped = true;
    }

    // --- gravity (asymmetric; low-jump extra gravity when released early) ---
    let g = stats.gravity;
    if (this.velocity.y < 0) g *= stats.fallGravityMult;
    else if (this.velocity.y > 0 && this.jumpActive && !intent.jumpHeld) g *= stats.lowJumpMult;
    this.velocity.y -= g * dt;
    if (this.velocity.y < -stats.maxFallSpeed) this.velocity.y = -stats.maxFallSpeed;
    if (this.velocity.y <= 0) this.jumpActive = false;

    // --- the mass path: external forces integrate every step (F/m, SPEC §2.2) ---
    this.velocity.addScaledVector(this.force, dt / stats.mass);
    this.force.set(0, 0, 0);

    // --- integrate + sweep + slide ---
    const wasGrounded = this.grounded;
    if (collider) {
      const target = this.position.clone().addScaledVector(this.velocity, dt);
      const sweep = collider.capsuleSweep(
        this.position,
        target,
        TUNING.player.radius,
        TUNING.player.height,
      );
      this.position.copy(sweep.position);
      for (const n of sweep.normals) {
        const into = this.velocity.dot(n);
        if (into < 0) this.velocity.addScaledVector(n, -into);
      }
      this.ground(collider, wasGrounded);
    } else {
      this.position.addScaledVector(this.velocity, dt);
      this.grounded = false;
    }

    if (this.grounded && !wasGrounded) events.landed = true;
    return events;
  }

  /** Downward probe: grounded state, slope check, ground snap. */
  private ground(collider: Collider, wasGrounded: boolean): void {
    if (this.snapSuppressTimer > 0) {
      // Just jumped: the snap must not recapture the capsule. This is a timer,
      // NOT a vy-sign check — slope-climbing produces small +vy via the slide
      // projection, and treating that as "airborne" made grounding flicker and
      // silently ate jumps on ramps (the VP's ramp-jump bug).
      this.grounded = false;
      return;
    }
    const radius = TUNING.player.radius;
    const origin = this.position.clone();
    origin.y += radius; // bottom-sphere centre
    const reach = radius + TUNING.player.groundSnapDist + GROUND_PROBE_EXTRA;
    const hit = collider.groundProbe(origin, reach);
    const maxSlopeCos = Math.cos(TUNING.player.maxSlopeDeg * DEG2RAD);

    if (hit && hit.normal.y >= maxSlopeCos) {
      const snapDist = wasGrounded ? TUNING.player.groundSnapDist : GROUND_PROBE_EXTRA + radius * 0.5;
      // Rest height for a capsule on an incline: the bottom sphere touches the
      // plane, so the feet sit r(1/n.y − 1) above the probe hit. On flat
      // ground that term is zero. Snapping to the raw hit sinks into slopes.
      const restY = hit.point.y + radius * (1 / hit.normal.y - 1);
      if (restY >= this.position.y - snapDist) {
        this.position.y = restY;
        this.groundNormal.copy(hit.normal);
        this.grounded = true;
        this.coyoteTimer = TUNING.player.coyoteTime;
        // Grounded: the snap owns height, so vertical velocity is zeroed in
        // BOTH signs — slope-slide +vy included. Climb rate comes from the
        // surface following x/z, and crests are exited horizontally.
        this.velocity.y = 0;
        return;
      }
    }
    this.grounded = false;
    if (hit && hit.normal.y < maxSlopeCos && hit.normal.y > 0) {
      // too steep: make sure we keep sliding rather than resting
      const into = this.velocity.dot(hit.normal);
      if (into < 0) this.velocity.addScaledVector(hit.normal, -into);
    }
  }

  /** Convenience for tests/HUD. */
  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  static upAxis(): THREE.Vector3 {
    return UP.clone();
  }
}
