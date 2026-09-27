import * as THREE from 'three';
import level01Json from './levels/level01.json';
import sandboxJson from './levels/sandbox.json';
import { buildElementRegistry } from './config/elements';
import { TUNING } from './config/tuning';
import { Debug } from './core/Debug';
import { EventBus } from './core/Events';
import { Game } from './core/Game';
import { installHarness } from './core/Harness';
import { Input } from './core/Input';
import { Time } from './core/Time';
import { TimeScale } from './core/TimeScale';
import { ELEMENT_IDS } from './elements/ElementModule';
import { PickupFx } from './elements/PickupFx';
import { Player } from './player/Player';
import { CameraRig } from './render/CameraRig';
import { Materials } from './render/Materials';
import { Renderer } from './render/Renderer';
import { FadeOverlay } from './ui/FadeOverlay';
import { Hud } from './ui/Hud';
import { installCoordPicker } from './world/CoordPicker';
import { Level } from './world/Level';
import { LevelBuilder } from './world/LevelBuilder';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing from index.html');

const scene = new THREE.Scene();
const debug = new Debug();
const materials = new Materials();
const registry = buildElementRegistry();
const bus = new EventBus();
const hud = new Hud();
const timeScale = new TimeScale();
const pickupFx = new PickupFx(timeScale);
// ?level=sandbox loads the DISPOSABLE M4a prop sandbox; default is level01.
const LEVELS: Record<string, unknown> = { '01': level01Json, level01: level01Json, sandbox: sandboxJson };
const levelName = new URLSearchParams(window.location.search).get('level') ?? 'level01';
const levelJson = LEVELS[levelName] ?? level01Json;
const level = new Level(scene, new LevelBuilder(materials), materials, debug, registry, bus);
level.load(levelJson);

const player = new Player(scene, () => level.collider);
// Props see the player only as a position and a force path — never its loadout.
const playerView = {
  get feet(): THREE.Vector3 {
    return player.position;
  },
  applyForce: (f: THREE.Vector3): void => {
    player.applyForce(f);
  },
};
player.setAbilityHooks({
  pushCone: (e, range, coneDeg) => level.pushCone(e, range, coneDeg, playerView),
  hitStop: (duration) => {
    timeScale.push('hitStop', TUNING.elements.hitStopScale, duration);
  },
});
function spawnPlayer(): void {
  const spawn = level.spawn;
  if (!spawn) return;
  const hit = level.collider?.groundProbe(spawn);
  const feet = hit ? new THREE.Vector3(spawn.x, hit.point.y, spawn.z) : spawn.clone();
  player.spawnAt(feet);
}
spawnPlayer();

const renderer = new Renderer(app);
const cameraRig = new CameraRig(renderer.aspect);
renderer.attachCamera(cameraRig.camera);

const game = new Game({
  time: new Time(),
  input: new Input(),
  debug,
  renderer,
  cameraRig,
  scene,
  player,
  timeScale,
  fade: new FadeOverlay(),
  pickupFx,
  updatables: [
    {
      update: (dt: number): void => {
        level.update(dt, playerView);
      },
    },
  ],
});

// The pickup moment: loadout + HUD + dilation/FOV stub. Element-blind wiring —
// everything below is module DATA looked up from the id the token carried.
bus.on('tokenPickup', ({ element }) => {
  const module = registry.get(element);
  player.addElement(module);
  hud.setSlot(module.bodyTint);
  pickupFx.trigger();
});

// Checkpoints move the respawn point (SPEC §6.3: respawn at the last checkpoint).
bus.on('checkpoint', ({ feet }) => {
  player.setSpawn(feet);
});

// F4 (CLAUDE.md rule 10): grant/revoke the first registered element for testing.
debug.registerToggle('F4', (on) => {
  if (on) {
    const module = registry.get(ELEMENT_IDS[0]);
    player.addElement(module);
    hud.setSlot(module.bodyTint);
  } else {
    player.clearElements();
    hud.setSlot(null);
  }
});

if (import.meta.env.DEV) {
  installCoordPicker(renderer.domElement, cameraRig.camera, () => level.collider);
}

// Level JSON hot reload: rebuild in place, no page refresh. Malformed JSON
// keeps the previous level and logs a block-specific LevelParseError.
if (import.meta.hot) {
  import.meta.hot.accept(['./levels/level01.json', './levels/sandbox.json'], ([l01, sbx]) => {
    const raw: unknown = levelJson === sandboxJson ? sbx?.default : l01?.default;
    if (raw !== undefined && level.tryReload(raw)) {
      // Keep the player where they stand; only the respawn point follows the JSON.
      const spawn = level.spawn;
      if (spawn) {
        const hit = level.collider?.groundProbe(spawn);
        player.setSpawn(hit ? new THREE.Vector3(spawn.x, hit.point.y, spawn.z) : spawn);
      }
    }
  });
}

// Harness mode (dev builds only): expose window.__stillmote and do NOT start
// the real-time loop — the harness drives the sim by exact fixed steps.
const harnessMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('harness');
if (harnessMode) {
  installHarness(game, () => level.signals.list());
} else {
  game.start();
}
