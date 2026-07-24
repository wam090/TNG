import type { ElementId, ElementModule } from './ElementModule';

/** ElementId → ElementModule. Assembled in config/elements.ts (data only). */
export class ElementRegistry {
  private readonly modules = new Map<ElementId, ElementModule>();

  register(module: ElementModule): void {
    if (this.modules.has(module.id)) {
      throw new Error(`ElementRegistry: "${module.id}" is already registered`);
    }
    this.modules.set(module.id, module);
  }

  get(id: ElementId): ElementModule {
    const module = this.modules.get(id);
    if (!module) throw new Error(`ElementRegistry: no module registered for "${id}"`);
    return module;
  }

  has(id: ElementId): boolean {
    return this.modules.has(id);
  }
}
