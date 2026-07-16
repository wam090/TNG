import * as THREE from 'three';
import { TUNING } from '../config/tuning';

export class Renderer {
  private readonly gl: THREE.WebGLRenderer;

  constructor(parent: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: true });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, TUNING.render.maxPixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    parent.appendChild(this.gl.domElement);
  }

  get aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  get domElement(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  /** Keep the drawing buffer and the camera projection in sync with the window. */
  attachCamera(camera: THREE.PerspectiveCamera): void {
    window.addEventListener('resize', () => {
      this.gl.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = this.aspect;
      camera.updateProjectionMatrix();
    });
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.render(scene, camera);
  }
}
