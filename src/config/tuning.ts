// EVERY tunable in the project lives here and nowhere else (CLAUDE.md rule 2).
// Source of truth: SPEC.md §9. Keys added beyond §9 are marked [M0+] and
// logged in DECISIONS.md.
export const TUNING = {
  loop: {
    fixedDt: 1 / 60,
    maxSubsteps: 5,
    maxFrameDelta: 0.25, // [M0+] Time.ts clamps the real frame delta to this
  },

  camera: {
    fov: 45,
    yawDeg: 45,
    pitchDeg: 38,
    distance: 16,
    heightOffset: 1.2,
    followStiffness: 8,
    lookAheadFactor: 0.35,
    near: 0.1, // [M0+]
    far: 300, // [M0+]
  },

  player: {
    radius: 0.35,
    height: 1.3,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    groundSnapDist: 0.25,
    maxSlopeDeg: 48,
    respawnFallY: -20,
    respawnFade: 0.18,
    squash: {
      land: [1.25, 0.72, 1.25],
      jump: [0.82, 1.22, 0.82],
      recover: 12,
      minImpactSpeed: 3, // [feel-fix] land-squash fires only for real falls, never micro-recontacts
    },
    jumpSnapSuppress: 0.1, // [feel-fix] ground-snap can't recapture within this window after a jump
    baseStats: {
      mass: 1.0,
      moveSpeed: 6.5,
      accelGround: 60,
      accelAir: 25,
      friction: 12,
      turnSpeed: 14,
      jumpHeight: 2.1, // metres — derive impulse from gravity
      gravity: 24, // NOT 9.8. Platformers need snap.
      fallGravityMult: 1.6,
      lowJumpMult: 2.2,
      maxFallSpeed: 28,
      airControl: 0.65,
    },
    // [M2+] procedural animation feel (SPEC §3.4 values) + landing indicator
    anim: {
      idleBobAmp: 0.03,
      idleBobPeriod: 2.2,
      leanMaxDeg: 12,
      leanStiffness: 10,
      runThreshold: 0.5, // horizontal speed above which Idle becomes Run
      landDuration: 0.12, // how long the Land state holds before Idle/Run
    },
    landingBlob: { radius: 0.3, opacity: 0.35 },
  },

  elements: {
    MAX_ACTIVE: 1, // ← flip to 2+ when you're ready to stack. Architecture already supports it.
    pickupTimeDilation: { scale: 0.25, duration: 0.3 },
    tintLerpTime: 0.35,
  },

  wind: {
    tint: '#A9B4BC',
    statMods: {
      mass: 0.6,
      jumpHeight: 2.6,
      fallGravityMult: 1.15,
      airControl: 0.85,
      moveSpeed: 7.2,
    },
    glide: { maxFallSpeed: 3.2, horizontalDrag: 0.92, airControl: 0.95, minAirTime: 0.15 },
    gust: {
      cooldown: 0.55,
      range: 5.5,
      coneDeg: 45,
      force: 18,
      selfImpulseAir: 5.0,
      selfImpulseGround: 0,
      windup: 0.08,
      duration: 0.18,
      hitStop: 0.04,
    },
    vfx: {
      streaks: 3,
      orbitRadius: 0.75,
      orbitSpeedBase: 2.2,
      orbitSpeedPerVel: 0.35,
      motes: 120,
      moteRadius: 1.1,
      moteDrift: 0.5,
      trailSpeedThreshold: 4.0,
    },
  },

  props: {
    windZone: { defaultForce: 9.5, period: 4.0, duration: 1.6, telegraph: 0.6 },
    updraft: { velocity: 9.0, maxHeight: 12 },
    windmill: { torqueDecay: 0.85, activateAt: 6.0 }, // rad/s to fire signal
  },

  // ── [M0+] sections below. scaffold.* dies at M1 when the level pipeline lands. ──

  render: {
    maxPixelRatio: 2,
    shadow: { mapSize: 2048, bias: -0.0005 }, // [M2+] directional shadow for grounding
  },

  input: {
    gamepadDeadzone: 0.15,
  },

  rng: {
    defaultSeed: 1, // [M0.5+] harness runs reseed explicitly; gameplay consumers arrive at M5
  },

  debug: {
    fpsWindow: 0.5, // seconds of frames averaged into the overlay fps figure
  },

} as const;
