import * as THREE from 'three';
import { TUNING } from './config/tuning';
import { Debug } from './core/Debug';
import { Game } from './core/Game';
import { installHarness } from './core/Harness';
import { Input } from './core/Input';
import { Time } from './core/Time';
import { CameraRig } from './render/CameraRig';
import { Renderer } from './render/Renderer';

/** M0 placeholder scene — replaced wholesale by the level pipeline at M1. */
function buildScaffoldScene(): { scene: THREE.Scene; target: THREE.Object3D } {
  const S = TUNING.scaffold;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(S.sky);

  const [gw, gh, gd] = S.groundSize;
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(gw, gh, gd),
    new THREE.MeshStandardMaterial({ color: S.groundColor }),
  );
  ground.position.y = -gh / 2; // top face flush with y=0
  scene.add(ground);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(S.cubeSize, S.cubeSize, S.cubeSize),
    new THREE.MeshStandardMaterial({ color: S.cubeColor }),
  );
  cube.position.y = S.cubeSize / 2; // resting on the ground
  scene.add(cube);

  const [sx, sy, sz] = S.sunDir;
  const sun = new THREE.DirectionalLight(0xffffff, S.sunIntensity);
  sun.position.set(-sx, -sy, -sz); // a light's position is the reverse of its direction
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, S.ambient));

  return { scene, target: cube };
}

const app = document.getElementById('app');
if (!app) throw new Error('#app mount point missing from index.html');

const renderer = new Renderer(app);
const cameraRig = new CameraRig(renderer.aspect);
renderer.attachCamera(cameraRig.camera);
const { scene, target } = buildScaffoldScene();

const game = new Game({
  time: new Time(),
  input: new Input(),
  debug: new Debug(),
  renderer,
  cameraRig,
  scene,
  target,
});

// Harness mode (dev builds only): expose window.__stillmote and do NOT start
// the real-time loop — the harness drives the sim by exact fixed steps.
const harnessMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('harness');
if (harnessMode) {
  installHarness(game);
} else {
  game.start();
}
