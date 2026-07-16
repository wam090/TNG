import * as THREE from 'three';
import levelJson from './levels/level01.json';
import { TUNING } from './config/tuning';
import { Debug } from './core/Debug';
import { Game } from './core/Game';
import { installHarness } from './core/Harness';
import { Input } from './core/Input';
import { Time } from './core/Time';
import { CameraRig } from './render/CameraRig';
import { Materials } from './render/Materials';
import { Renderer } from './render/Renderer';
import { installCoordPicker } from './world/CoordPicker';
import { Level } from './world/Level';
import { LevelBuilder } from './world/LevelBuilder';

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing from index.html');

const scene = new THREE.Scene();
const debug = new Debug();
const materials = new Materials();
const level = new Level(scene, new LevelBuilder(materials), debug);
level.load(levelJson);

// Camera-target stand-in until the M2 player: an accent cube resting on the
// ground directly beneath the level's spawn point (placed via ground probe).
const target = new THREE.Mesh(
  new THREE.BoxGeometry(TUNING.scaffold.cubeSize, TUNING.scaffold.cubeSize, TUNING.scaffold.cubeSize),
  materials.get('accent'),
);
scene.add(target);
function placeTargetAtSpawn(): void {
  const spawn = level.spawn;
  if (!spawn) return;
  const hit = level.collider?.groundProbe(spawn);
  const y = hit ? hit.point.y + TUNING.scaffold.cubeSize / 2 : spawn.y;
  target.position.set(spawn.x, y, spawn.z);
}
placeTargetAtSpawn();

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
  target,
});

if (import.meta.env.DEV) {
  installCoordPicker(renderer.domElement, cameraRig.camera, () => level.collider);
}

// Level JSON hot reload: rebuild in place, no page refresh. Malformed JSON
// keeps the previous level and logs a block-specific LevelParseError.
if (import.meta.hot) {
  import.meta.hot.accept('./levels/level01.json', (mod) => {
    const raw: unknown = mod?.default;
    if (raw !== undefined && level.tryReload(raw)) placeTargetAtSpawn();
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
