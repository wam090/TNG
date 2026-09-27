import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Debug } from '../core/Debug';
import type { EventBus, PushEvent } from '../core/Events';
import { DEG2RAD } from '../core/Math';
import type { ElementRegistry } from '../elements/ElementRegistry';
import type { Materials } from '../render/Materials';
import { Collider } from './Collider';
import type { BuiltLevel, LevelBuilder } from './LevelBuilder';
import { parseLevel } from './LevelSchema';
import type { Prop, PropContext, PropPlayerView } from './props/Prop';
import { createProp } from './props/PropFactory';
import { Token } from './props/Token';
import { LevelParseError } from './SchemaUtil';
import { Signals } from './Signals';

const WIREFRAME_COLOR = '#39FF6A'; // debug green, X-ray (drawn through geometry)

/**
 * Owns the currently-loaded level: build, hot-rebuild, dispose, props and
 * their signals, push delivery, and the F2 (collider wireframe) / F3 (prop
 * gizmo) debug views. Solid props (closed gates, windmill towers) are merged
 * into the collider; when a prop's solidity changes the collider is rebuilt.
 */
export class Level {
  readonly signals = new Signals();
  private built: BuiltLevel | null = null;
  private activeCollider: Collider | null = null; // built.collider, or built + prop solids
  private wireframe: THREE.Mesh | null = null;
  private readonly wireframeMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: WIREFRAME_COLOR,
    depthTest: false,
    transparent: true,
  });
  private readonly gizmos = new THREE.Group();
  private tokens: Token[] = [];
  private props: Prop[] = [];
  private solidKey = '';
  private levelId = '';

  constructor(
    private readonly scene: THREE.Scene,
    private readonly builder: LevelBuilder,
    private readonly materials: Materials,
    private readonly debug: Pick<Debug, 'registerToggle' | 'isToggleOn'>,
    private readonly registry: ElementRegistry,
    private readonly bus: EventBus,
  ) {
    debug.registerToggle('F2', (on) => {
      if (this.wireframe) this.wireframe.visible = on;
    });
    this.gizmos.name = 'prop-gizmos';
    scene.add(this.gizmos);
    debug.registerToggle('F3', (on) => {
      this.gizmos.visible = on;
    });
  }

  /** Build from raw JSON. Throws LevelParseError with a block-specific message on bad data. */
  load(raw: unknown): void {
    const data = parseLevel(raw); // validate BEFORE tearing anything down
    this.disposeContent();

    this.levelId = data.id;
    this.built = this.builder.build(data, this.scene);
    this.signals.reset();

    // Tokens rebuild with the level (dev note: a picked-up Core reappears on
    // JSON hot-reload — re-picking is a harmless same-module swap).
    this.tokens = data.tokens.map(
      (spec) =>
        new Token(spec, this.registry.get(spec.element).bodyTint, this.scene, (picked) => {
          this.bus.emit('tokenPickup', { element: picked.element, tokenId: picked.id });
        }),
    );
    this.props = data.props.map((p) => createProp(p, { scene: this.scene, materials: this.materials }));
    for (const prop of this.props) this.gizmos.add(prop.gizmo);
    this.rebuildCollider();
  }

  /** One fixed sim step (world/scaled time) for level-owned props. */
  update(dt: number, player: PropPlayerView): void {
    for (const token of this.tokens) token.update(dt, player.feet);
    const ctx = this.context(player);
    for (const prop of this.props) prop.update(dt, ctx);
    if (this.currentSolidKey() !== this.solidKey) this.rebuildCollider();
  }

  /**
   * Deliver a push to every pushable prop inside the cone. Range is a 3D
   * distance from the origin; the cone is horizontal (azimuth within
   * coneDeg/2 of the aim), so a tall windmill hub is not missed for sitting
   * above the gust. Returns how many props were hit.
   */
  pushCone(e: PushEvent, range: number, coneDeg: number, player: PropPlayerView): number {
    const cosHalf = Math.cos((coneDeg / 2) * DEG2RAD);
    const aim = new THREE.Vector2(e.dir.x, e.dir.z).normalize();
    const ctx = this.context(player);
    let hits = 0;
    for (const prop of this.props) {
      const target = prop.pushTarget();
      if (!target) continue;
      const d = target.clone().sub(e.origin);
      if (d.length() > range) continue;
      const flat = new THREE.Vector2(d.x, d.z);
      if (flat.lengthSq() > 0 && flat.normalize().dot(aim) < cosHalf) continue;
      prop.onPush(e, ctx);
      hits += 1;
    }
    return hits;
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

  private context(player: PropPlayerView): PropContext {
    return {
      player,
      signals: this.signals,
      setCheckpoint: (id, feet) => {
        this.bus.emit('checkpoint', { id, feet });
      },
      collectShard: (id) => {
        this.bus.emit('shardCollected', { id });
      },
      completeLevel: () => {
        this.bus.emit('levelComplete', { levelId: this.levelId });
      },
    };
  }

  private currentSolidKey(): string {
    return this.props.map((p) => (p.solid() ? '1' : '0')).join('');
  }

  /** Static level geometry + every currently-solid prop → one collider (and the F2 view). */
  private rebuildCollider(): void {
    if (!this.built) return;
    if (this.activeCollider && this.activeCollider !== this.built.collider) this.activeCollider.dispose();
    const solids = this.props.map((p) => p.solid()).filter((g): g is THREE.BufferGeometry => g !== null);
    if (solids.length === 0) {
      this.activeCollider = this.built.collider;
    } else {
      // The BVH indexes its geometry in place; solids are non-indexed — match them.
      const base = this.built.collider.geometry.toNonIndexed();
      this.activeCollider = new Collider(mergeGeometries([base, ...solids], false));
      base.dispose();
    }
    this.solidKey = this.currentSolidKey();

    if (this.wireframe) this.scene.remove(this.wireframe);
    this.wireframe = new THREE.Mesh(this.activeCollider.geometry, this.wireframeMaterial);
    this.wireframe.visible = this.debug.isToggleOn('F2');
    this.scene.add(this.wireframe);
  }

  private disposeContent(): void {
    if (this.wireframe) this.scene.remove(this.wireframe);
    this.wireframe = null;
    if (this.activeCollider && this.activeCollider !== this.built?.collider) this.activeCollider.dispose();
    this.activeCollider = null;
    this.built?.dispose();
    this.built = null;
    for (const token of this.tokens) token.dispose();
    for (const prop of this.props) prop.dispose();
    this.tokens = [];
    this.props = [];
    this.gizmos.clear();
  }

  get spawn(): THREE.Vector3 | null {
    return this.built?.spawn ?? null;
  }

  get collider(): Collider | null {
    return this.activeCollider;
  }
}
