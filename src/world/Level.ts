import * as THREE from 'three';
import type { Debug } from '../core/Debug';
import type { EventBus } from '../core/Events';
import type { ElementRegistry } from '../elements/ElementRegistry';
import type { Collider } from './Collider';
import type { BuiltLevel, LevelBuilder } from './LevelBuilder';
import { LevelParseError, parseLevel } from './LevelSchema';
import { Token } from './props/Token';

const WIREFRAME_COLOR = '#39FF6A'; // debug green, X-ray (drawn through geometry)

/**
 * Owns the currently-loaded level: build, hot-rebuild, dispose, and the F2
 * collider-wireframe debug view (the merged collision surface, not BVH boxes —
 * you author against surfaces, not the tree).
 */
export class Level {
  private built: BuiltLevel | null = null;
  private wireframe: THREE.Mesh | null = null;
  private readonly wireframeMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: WIREFRAME_COLOR,
    depthTest: false,
    transparent: true,
  });

  private tokens: Token[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly builder: LevelBuilder,
    private readonly debug: Debug,
    private readonly registry: ElementRegistry,
    private readonly bus: EventBus,
  ) {
    debug.registerToggle('F2', (on) => {
      if (this.wireframe) this.wireframe.visible = on;
    });
  }

  /** Build from raw JSON. Throws LevelParseError with a block-specific message on bad data. */
  load(raw: unknown): void {
    const data = parseLevel(raw); // validate BEFORE tearing anything down
    if (this.wireframe) this.scene.remove(this.wireframe);
    this.built?.dispose();
    for (const token of this.tokens) token.dispose();

    this.built = this.builder.build(data, this.scene);
    this.wireframe = new THREE.Mesh(this.built.collider.geometry, this.wireframeMaterial);
    this.wireframe.visible = this.debug.isToggleOn('F2');
    this.scene.add(this.wireframe);

    // Tokens rebuild with the level (dev note: a picked-up Core reappears on
    // JSON hot-reload — re-picking is a harmless same-module swap).
    this.tokens = data.tokens.map(
      (spec) =>
        new Token(spec, this.registry.get(spec.element).bodyTint, this.scene, (picked) => {
          this.bus.emit('tokenPickup', { element: picked.element, tokenId: picked.id });
        }),
    );
  }

  /** One fixed sim step (world/scaled time) for level-owned props. */
  update(dt: number, playerFeet: THREE.Vector3): void {
    for (const token of this.tokens) token.update(dt, playerFeet);
  }

  /** Hot-reload path: malformed JSON keeps the previous level and logs the clear error. */
  tryReload(raw: unknown): boolean {
    try {
      this.load(raw);
      return true;
    } catch (e) {
      if (e instanceof LevelParseError) {
        console.error(`[level] ${e.message} — keeping the previous level`);
        return false;
      }
      throw e;
    }
  }

  get spawn(): THREE.Vector3 | null {
    return this.built?.spawn ?? null;
  }

  get collider(): Collider | null {
    return this.built?.collider ?? null;
  }
}
