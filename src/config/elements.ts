import { ElementRegistry } from '../elements/ElementRegistry';
import { windModule } from '../elements/wind/WindModule';

/**
 * Element registry assembly — data only (SPEC §8.5). Adding an element is one
 * module file plus ONE line here. Player.ts is never touched (CLAUDE.md rule 6).
 */
export function buildElementRegistry(): ElementRegistry {
  const registry = new ElementRegistry();
  registry.register(windModule);
  return registry;
}
