// SPEC §8.6, verbatim. Lives in its own file so M3's resolveStats can import
// it without ever touching Player.ts (CLAUDE.md hard rule 6).
export interface PlayerStats {
  mass: number;
  moveSpeed: number;
  accelGround: number;
  accelAir: number;
  friction: number;
  turnSpeed: number;
  jumpHeight: number;
  gravity: number;
  fallGravityMult: number;
  lowJumpMult: number;
  maxFallSpeed: number;
  airControl: number;
}
