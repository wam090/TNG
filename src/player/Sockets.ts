// SPEC §3.2 — the morph rig. Elements bolt meshes onto these anchors at M3+.
// Offsets are structural rig geometry (like the chassis proportions), not feel
// tunables — they live here as named constants, local to the body group.
export type SocketId =
  | 'crown' // above head — rotors, flames, halos
  | 'head'
  | 'chest' // core gem / element crystal
  | 'back' // wings, shell, fins
  | 'orbitLow' // waist-height orbital ring
  | 'orbitHigh' // shoulder-height orbital ring
  | 'feet' // ground contact FX
  | 'trail' // behind, for motion trails
  | 'handL'
  | 'handR'; // reserved, unused in v1

export const SOCKET_OFFSETS: Record<SocketId, readonly [number, number, number]> = {
  crown: [0, 1.62, 0],
  head: [0, 1.27, 0],
  chest: [0, 0.85, 0],
  back: [0, 0.75, -0.32],
  orbitLow: [0, 0.5, 0],
  orbitHigh: [0, 1.0, 0],
  feet: [0, 0.02, 0],
  trail: [0, 0.55, -0.5],
  handL: [-0.45, 0.72, 0],
  handR: [0.45, 0.72, 0],
};
