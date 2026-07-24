import * as THREE from 'three';
import levelJson from './levels/level01.json';
import { buildElementRegistry } from './config/elements';
import { Debug } from './core/Debug';
import { EventBus } from './core/Events';
import { Game } from './core/Game';
import { installHarness } from './core/Harness';
import { Input } from './core/Input';
import { Time } from './core/Time';
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
const pickupFx = new PickupFx();
const level = new Level(scene, new LevelBuilder(materials), debug, registry, bus);
level.load(levelJson);

const player = new Player(scene, () => level.collider);
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
  fade: new FadeOverlay(),
  pickupFx,
  updatables: [
    {
      update: (dt: number): void => {
        level.update(dt, player.position);
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
  import.meta.hot.accept('./levels/level01.json', (mod) => {
    const raw: unknown = mod?.default;
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
  installHarness(game);
} else {
  game.start();
}
