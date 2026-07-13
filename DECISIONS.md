# DECISIONS — STILLMOTE

- M0: `damp()` is the 2-arg alpha form `damp(stiffness, dt)` (owner instruction + CLAUDE.md's own example); SPEC §4.3's 4-arg form is superseded.
- M0: TUNING gained keys beyond SPEC §9, all logged here so §9 stays the reference: `loop.maxFrameDelta` (owner amendment), `camera.near/far`, `render.maxPixelRatio`, `input.gamepadDeadzone`, `debug.fpsWindow`, `scaffold.*` (M0 placeholder scene — dies at M1).
- M0: substep cap DRAINS the accumulator (slow-mo degradation, no spiral of death); every drain shows a permanent red counter + last-dropped-ms in the F1 overlay (owner amendment).
- M0: bindings — WASD/arrows move, Space jump, E action; gamepad left stick, A jump, X action. Bindings live as named constants in Input.ts (mappings, not tunables).
- M0: input move vector convention is +y = down-screen (gamepad stick convention), matching SPEC §4.2's `Vector3(x, 0, y)` camera-relative rotation planned for M2.
- M0: `Math.test.ts` exists at M0 because `npm run test` must pass and vitest exits non-zero with zero test files; tests damp() composition (frame-rate independence), clamp, Rng determinism.
- M0: vite `base: './'` so the eventual static deploy (itch.io, SPEC §8.1) works from a subpath unchanged.
- M0: visual verification done via scratchpad playwright-core + preinstalled Chromium (NOT a project dependency); M0.5 turns this into the real in-repo screenshot harness.
