import type { ElementId } from '../elements/ElementModule';

/** All game events, typed. Grows at M4 with PushEvent/signal wiring. */
export interface GameEvents {
  tokenPickup: { element: ElementId; tokenId: string };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

/** Tiny typed event bus (SPEC §8.1: plain classes + a tiny typed event bus). */
export class EventBus {
  private readonly handlers = new Map<keyof GameEvents, Set<(payload: unknown) => void>>();

  /** Subscribe; returns an unsubscribe function. */
  on<K extends keyof GameEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    const erased = handler as (payload: unknown) => void;
    set.add(erased);
    return () => set.delete(erased);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}
