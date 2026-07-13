# DECISIONS — STILLMOTE

- M0: `damp()` is the 2-arg alpha form `damp(stiffness, dt)` (owner instruction + CLAUDE.md's own example); SPEC §4.3's 4-arg form is superseded.
- M0: TUNING gained keys beyond SPEC §9, all logged here so §9 stays the reference: `loop.maxFrameDelta` (owner amendment), `camera.near/far`, `render.maxPixelRatio`, `input.gamepadDeadzone`, `debug.fpsWindow`, `scaffold.*` (M0 placeholder scene — dies at M1).
- M0: substep cap DRAINS the accumulator (slow-mo degradation, no spiral of death); every drain shows a permanent red counter + last-dropped-ms in the F1 overlay (owner amendment).
- M0: bindings — WASD/arrows move, Space jump, E action; gamepad left stick, A jump, X action. Bindings live as named constants in Input.ts (mappings, not tunables).
- M0: input move vector convention is +y = down-screen (gamepad stick convention), matching SPEC §4.2's `Vector3(x, 0, y)` camera-relative rotation planned for M2.
- M0: `Math.test.ts` exists at M0 because `npm run test` must pass and vitest exits non-zero with zero test files; tests damp() composition (frame-rate independence), clamp, Rng determinism.
- M0: vite `base: './'` so the eventual static deploy (itch.io, SPEC §8.1) works from a subpath unchanged.
- M0: visual verification done via scratchpad playwright-core + preinstalled Chromium (NOT a project dependency); M0.5 turns this into the real in-repo screenshot harness.
- M0.5: dependency added — `playwright` (devDep): drives headless Chromium for the deterministic visual regression harness (SPEC §8.4); on a new machine run `npx playwright install chromium` once. Exact versions at M0.5: three@0.185.1, @types/three@0.185.1, typescript@6.0.3, vite@8.1.4, vitest@4.1.10, eslint@10.7.0, @eslint/js@10.0.1, typescript-eslint@8.63.0, playwright@1.61.1.
- M0.5: harness = `window.__stillmote` {step, seed, input, state}, installed only when `import.meta.env.DEV && ?harness=1`; step(n) calls update(fixedDt) directly — Time and the accumulator are never involved, so substep-cap drains are structurally impossible in a harness run; verified absent from the prod bundle (grep dist → 0 hits).
- M0.5: input scripts (`scripts/*.json`) use semantic buttons (up/down/left/right/jump/action) and [from, until) step segments so timelines survive key rebinding; node tooling lives in `tools/`, input timelines in `scripts/` — two folders so "scripts" stays unambiguous.
- M0.5: shot:check pixel-diffs inside headless Chromium's canvas — zero image-decoding dependencies (no pixelmatch/pngjs); defaults: fail past 0.1% differing pixels, per-channel tolerance 3; red-on-washed-out diff artifacts in `shots/diff/` (gitignored). Verified: fresh-run determinism = 0 px diff on all 4 goldens; cube tint #D0342C→#D0552C fails 4/4 at 0.51%; failing check exits 1.
- M0.5: goldens are overlay-OFF renders at fixed 1280×720@1 (text rasterisation is the brittle part; `--debug` overlay shots are for eyeballing only); `shots/*.png` gitignored, `shots/golden/` committed.
- M0.5: index.html favicon is an empty data URI so the harness's fail-on-any-console-error policy stays strict (no favicon 404 noise to whitelist).
- M0.5: STANDING RULE — after any visual change, run the harness and VIEW the PNGs before declaring done.
