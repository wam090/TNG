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
    jumpSnapSuppress: 0.1, // [feel-fix] ground-snap can't recapture within this window after a jump (also after any upward launch)
    // [M4a] External pushes (wind zones, Gust recoil) ride their own velocity channel that steering
    // never brakes; it fades at this rate (1/s). Terminal speed in a zone = force / (mass × drag).
    // VP-approved 2026-09-27 (sandbox); re-judged in Level 1 context. Menu was 1.5 / 2.5 / 4.0.
    externalDrag: 2.5,
    // [M4a] Speed safety cap (m/s): clamps |velocity| below the verified 60 m/s collision envelope and is
    // counted in F1. It must NEVER engage in designed play — any hit is a level or tuning bug.
    maxSpeedSafety: 55,
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
    fovPunch: { delta: -4, inTime: 0.1, outTime: 0.4 }, // [M3+ stub feel — VP owns these at M5]
    hitStopScale: 0, // SPEC §5.2 "freeze the sim" (MIN-combined with dilation). VP-approved 2026-09-27 (sandbox)
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
      // HALF-angle of the cone (±). PROVISIONAL (WO-004, ruling 2): the VP judges it at his
      // next play from the menu 30 / 37.5 / 45. Was `coneDeg` 45 read as the full cone (±22.5°).
      coneHalfDeg: 45,
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
    updraft: {
      velocity: 9.0, // rise-speed ceiling (m/s): the lift stops pushing once vy reaches it
      maxHeight: 12, // default column height when JSON omits "size"
      width: 3, // [M4a] default column footprint (SPEC §7 sample size [3, 12, 3])
      // Upward FORCE (DM ruling: mass-sensitive). VP-approved 2026-09-27 (sandbox); re-judged
      // in Level 1 context. Must stay inside (lightMass·g·lightFallMult, baseMass·g) = (16.56, 24)
      // so the light body rises even when it drops in and the base body cannot rise at all.
      force: 20,
    },
    gate: { openTime: 1.2, size: [3, 3, 0.4] }, // openTime VP-approved 2026-09-27 (sandbox); default slab
    debris: { threshold: 8 }, // [M4a] SPEC §6.4 default push force; JSON may override
    // threshold per SPEC; current reach/width/height/force VP-approved 2026-09-27 (sandbox); bladeSpin rad/s (visual)
    fan: { threshold: 10, reach: 14, width: 4, height: 4, force: 9.5, bladeSpin: 14 },
    checkpoint: { radius: 1.5 }, // [M4a] trigger radius around the respawn point
    // [M4a] pickup radius; visuals. WO-004 A2 / SPEC colour language: a violet TETRAHEDRON —
    // never the Core's octahedron, never an element hue (Wind grey-blue, Fire red/orange,
    // Water blue, Earth brown/ochre). Candidate for the VP's veto.
    shard: { radius: 0.8, spinRate: 1.8, visualRadius: 0.26, color: '#9B4FD0', glow: 0.3 },
    goal: { radius: 1.5, height: 6 }, // [M4a] default radius (SPEC §7 sample) and light-pillar height
    windmill: {
      torqueDecay: 0.85, // fraction of spin kept per SECOND (frame-rate independent reading)
      activateAt: 6.0, // rad/s to fire signal
      threshold: 12, // [M4a] default push force needed (SPEC §6.4); JSON may override per windmill
      spinPerForce: 0.5, // rad/s per unit of push force (one Gust → 9 rad/s). VP-approved 2026-09-27 (sandbox)
    },
    token: {
      spinRate: 1.4, // rad/s
      bobAmp: 0.12,
      bobPeriod: 2.6,
      visualRadius: 0.3,
      pickupRadius: 0.9,
    }, // [M3+]
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
