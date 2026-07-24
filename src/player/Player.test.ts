import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../config/tuning';
import type { InputSnapshot } from '../core/Input';
import { ELEMENT_IDS, type ElementModule } from '../elements/ElementModule';
import { Player } from './Player';

const IDLE_SNAP: InputSnapshot = {
  move: { x: 0, y: 0 },
  jumpPressed: false,
  jumpHeld: false,
  jumpReleased: false,
  actionPressed: false,
  actionHeld: false,
  actionReleased: false,
};
const DT = TUNING.loop.fixedDt;

// Synthetic modules — ids come from ELEMENT_IDS so no element literal ever
// appears in player/** (the lint tripwire stays unreachable even in tests).
const makeModule = (idIndex: number, statMods: Record<string, number>, tint: string): ElementModule => ({
  id: ELEMENT_IDS[idIndex] ?? ELEMENT_IDS[0],
  displayName: 'Test Module',
  bodyTint: tint,
  tags: [],
  statMods,
  attachments: [
    {
      socket: 'orbitLow',
      build: () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()),
    },
  ],
  abilities: [],
  vfx: () => ({ update: () => undefined, dispose: () => undefined }),
});

function makePlayer(): { player: Player; scene: THREE.Scene } {
  const scene = new THREE.Scene();
  const player = new Player(scene, () => null);
  return { player, scene };
}

function socketChildCount(scene: THREE.Scene, socketName: string): number {
  const socket = scene.getObjectByName(socketName);
  return socket ? socket.children.length : -1;
}

function tick(player: Player, steps: number): void {
  for (let i = 0; i < steps; i += 1) player.update(DT, DT, IDLE_SNAP);
}

describe('loadout', () => {
  it('addElement applies stat overrides and attaches to sockets', () => {
    const { player, scene } = makePlayer();
    player.addElement(makeModule(0, { moveSpeed: 9 }, '#A9B4BC'));
    expect(player.stats.moveSpeed).toBe(9);
    expect(player.elementCount).toBe(1);
    expect(socketChildCount(scene, 'socket:orbitLow')).toBe(1);
  });

  it('at MAX_ACTIVE the oldest is EVICTED (swap, not reject)', () => {
    expect(TUNING.elements.MAX_ACTIVE).toBe(1); // test assumes the v1 cap
    const { player, scene } = makePlayer();
    const first = makeModule(0, { moveSpeed: 9 }, '#A9B4BC');
    const second = makeModule(1, { jumpHeight: 1.5 }, '#C97B4A');
    player.addElement(first);
    player.addElement(second);
    expect(player.elementCount).toBe(1);
    expect(player.stats.jumpHeight).toBe(1.5); // second's override active
    expect(player.stats.moveSpeed).toBe(TUNING.player.baseStats.moveSpeed); // first's gone
    expect(socketChildCount(scene, 'socket:orbitLow')).toBe(1); // swapped, not stacked
  });

  it('grant → revoke returns EXACTLY to base: stats, tint and attachments, no residue', () => {
    const { player, scene } = makePlayer();
    const baseline = JSON.stringify({ ...TUNING.player.baseStats });
    const module = makeModule(0, { mass: 0.6, moveSpeed: 7.2, fallGravityMult: 1.15 }, '#A9B4BC');

    player.addElement(module);
    tick(player, 40); // let the tint envelope (0.35s = 21 steps) finish
    expect(player.tintHex).toBe('#A9B4BC');
    expect(player.stats.mass).toBe(0.6);
    expect(socketChildCount(scene, 'socket:orbitLow')).toBe(1);

    player.clearElements();
    tick(player, 40);
    expect(player.elementCount).toBe(0);
    expect(JSON.stringify(player.stats)).toBe(baseline);
    expect(player.tintHex).toBe('#F2EDE4');
    expect(socketChildCount(scene, 'socket:orbitLow')).toBe(0);
  });

  it('tint envelope runs on RAW time, unaffected by a dilated world dt', () => {
    const { player } = makePlayer();
    player.addElement(makeModule(0, {}, '#A9B4BC'));
    // Simulate dilation: world dt scaled to 0.25×, raw dt unchanged.
    for (let i = 0; i < 40; i += 1) player.update(DT * 0.25, DT, IDLE_SNAP);
    expect(player.tintHex).toBe('#A9B4BC'); // 40 raw steps > 0.35s — done
  });
});
