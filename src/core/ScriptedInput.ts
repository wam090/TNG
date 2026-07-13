import type { InputSnapshot, InputSource } from './Input';

const BUTTONS = ['up', 'down', 'left', 'right', 'jump', 'action'] as const;
export type ScriptButton = (typeof BUTTONS)[number];

export interface ScriptSegment {
  /** First fixed step (inclusive) on which `hold` is held. */
  from: number;
  /** Fixed step (exclusive) on which `hold` is released. */
  until: number;
  hold: ScriptButton[];
}

/** A deterministic input timeline: which semantic buttons are held on each fixed sim step. */
export interface InputScript {
  name: string;
  steps: number;
  segments: ScriptSegment[];
}

function isScriptButton(v: unknown): v is ScriptButton {
  return typeof v === 'string' && (BUTTONS as readonly string[]).includes(v);
}

/** Validate untrusted JSON into an InputScript. Throws with a specific message on malformed input. */
export function parseInputScript(raw: unknown): InputScript {
  if (typeof raw !== 'object' || raw === null) throw new Error('input script: not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== 'string' || o.name.length === 0)
    throw new Error('input script: "name" must be a non-empty string');
  if (typeof o.steps !== 'number' || !Number.isInteger(o.steps) || o.steps <= 0)
    throw new Error('input script: "steps" must be a positive integer');
  if (!Array.isArray(o.segments)) throw new Error('input script: "segments" must be an array');

  const segments = o.segments.map((seg: unknown, i: number): ScriptSegment => {
    if (typeof seg !== 'object' || seg === null)
      throw new Error(`input script: segments[${i.toFixed(0)}] is not an object`);
    const s = seg as Record<string, unknown>;
    if (typeof s.from !== 'number' || !Number.isInteger(s.from) || s.from < 0)
      throw new Error(`input script: segments[${i.toFixed(0)}].from must be an integer >= 0`);
    if (typeof s.until !== 'number' || !Number.isInteger(s.until) || s.until <= s.from)
      throw new Error(`input script: segments[${i.toFixed(0)}].until must be an integer > from`);
    if (!Array.isArray(s.hold) || !s.hold.every(isScriptButton))
      throw new Error(
        `input script: segments[${i.toFixed(0)}].hold must be an array of ${BUTTONS.join('|')}`,
      );
    return { from: s.from, until: s.until, hold: s.hold };
  });

  return { name: o.name, steps: o.steps, segments };
}

/**
 * InputSource driven by an InputScript instead of devices. Each poll() is one
 * fixed sim step; edges are computed exactly like the real Input. Pure and
 * deterministic — same script, same snapshots, every run.
 */
export class ScriptedInput implements InputSource {
  private step = 0;
  private prevJumpHeld = false;
  private prevActionHeld = false;

  constructor(private readonly script: InputScript) {}

  poll(): InputSnapshot {
    const held = new Set<ScriptButton>();
    for (const seg of this.script.segments) {
      if (this.step >= seg.from && this.step < seg.until) {
        for (const b of seg.hold) held.add(b);
      }
    }

    let x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    let y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    const jumpHeld = held.has('jump');
    const actionHeld = held.has('action');
    const snapshot: InputSnapshot = {
      move: { x, y },
      jumpPressed: jumpHeld && !this.prevJumpHeld,
      jumpHeld,
      jumpReleased: !jumpHeld && this.prevJumpHeld,
      actionPressed: actionHeld && !this.prevActionHeld,
      actionHeld,
      actionReleased: !actionHeld && this.prevActionHeld,
    };
    this.prevJumpHeld = jumpHeld;
    this.prevActionHeld = actionHeld;
    this.step += 1;
    return snapshot;
  }
}
