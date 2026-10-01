import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Debug } from '../core/Debug';
import type { EventBus, PushEvent } from '../core/Events';
import type { ElementRegistry } from '../elements/ElementRegistry';
import type { Materials } from '../render/Materials';
import { Collider } from './Collider';
import type { BuiltLevel, LevelBuilder } from './LevelBuilder';
import { parseLevel } from './LevelSchema';
import { Checkpoint } from './props/Checkpoint';
import { pushHits, pushReach } from './PushCone';
import { PushGizmo, type PushGizmoTarget } from './PushGizmo';
import type { Prop, PropContext, PropPlayerView } from './props/Prop';
import { createProp } from './props/PropFactory';
import { Shard } from './props/Shard';
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
  private readonly pushGizmo = new PushGizmo();
  private tokens: Token[] = [];
  private props: Prop[] = [];
  private solidKey = '';
  private levelId = '';
  private sky = '';

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
    this.gizmos.add(this.pushGizmo.group);
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
    this.sky = data.env.sky;
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
    this.pushGizmo.update(dt);
    if (this.currentSolidKey() !== this.solidKey) this.rebuildCollider();
  }

  /**
   * Deliver a push to every pushable prop it reaches: its BOUNDS within
   * `range` (3D) and within ±`coneHalfDeg` of the aim (horizontal). Measured
   * against bounds, not a centre point, so the same distance to a prop's edge
   * registers the same on every prop. F3 shows the wedge and each pushable's
   * hit/miss for `debugShowFor` seconds. Returns how many props were hit.
   */
  pushCone(e: PushEvent, range: number, coneHalfDeg: number, player: PropPlayerView, debugShowFor: number): number {
    const aim = new THREE.Vector3(e.dir.x, 0, e.dir.z).normalize();
    const ctx = this.context(player);
    const shown: PushGizmoTarget[] = [];
    let hits = 0;
    for (const prop of this.props) {
      const bounds = prop.pushBounds();
      if (!bounds) continue;
      const hit = pushHits(pushReach(e.origin, aim, bounds), range, coneHalfDeg);
      shown.push({ bounds, hit });
      if (!hit) continue;
      prop.onPush(e, ctx);
      hits += 1;
    }
    this.pushGizmo.show(e.origin, aim, range, coneHalfDeg, shown, debugShowFor);
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
      reportLift: (id) => {
        this.bus.emit('updraftLift', { id });
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
    this.pushGizmo.clear();
    this.gizmos.clear();
    this.gizmos.add(this.pushGizmo.group);
  }

  /** Respawn points of every checkpoint, in JSON order (F5 cycles through these). */
  get checkpoints(): THREE.Vector3[] {
    return this.props.filter((p): p is Checkpoint => p instanceof Checkpoint).map((c) => c.respawn);
  }

  /** Shards taken so far, of those placed in the level (the Level Complete card's row). */
  get shards(): { found: number; total: number } {
    const all = this.props.filter((p): p is Shard => p instanceof Shard);
    return { found: all.filter((s) => s.isCollected).length, total: all.length };
  }

  /** The level's sky colour (the Level Complete fade goes toward it). */
  get skyColor(): string {
    return this.sky;
  }

  get spawn(): THREE.Vector3 | null {
    return this.built?.spawn ?? null;
  }

  get collider(): Collider | null {
    return this.activeCollider;
  }
}
