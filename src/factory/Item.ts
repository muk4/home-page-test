import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { COLORS } from '../config';
import { accentLine, gearPoints } from './draw';

export type ItemKind = 'ore' | 'plate' | 'gear';

export interface Item {
  kind: ItemKind;
  gfx: Graphics;
}

/** Items share one GraphicsContext per kind and are recycled, so moving them is just a transform. */
export class ItemPool {
  private readonly contexts: Record<ItemKind, GraphicsContext>;
  private readonly free: Record<ItemKind, Item[]> = { ore: [], plate: [], gear: [] };
  private readonly layer: Container;

  constructor(layer: Container, T: number) {
    this.layer = layer;
    const r = T * 0.17;
    const ore = [1, 0.15, 0.45, 0.95, -0.55, 0.8, -1, -0.05, -0.4, -0.9, 0.65, -0.75].map((v) => v * r);
    const s = T * 0.28;
    this.contexts = {
      ore: new GraphicsContext().poly(ore).fill({ color: COLORS.accent, alpha: 0.28 }).stroke(accentLine(0.95)),
      plate: new GraphicsContext()
        .rect(-s / 2, -s / 2, s, s)
        .fill({ color: COLORS.accent, alpha: 0.85 })
        .stroke(accentLine(1, 1)),
      gear: new GraphicsContext()
        .poly(gearPoints(7, T * 0.19, T * 0.13))
        .fill({ color: COLORS.accent, alpha: 0.3 })
        .stroke(accentLine(1, 1.25))
        .circle(0, 0, T * 0.045)
        .fill({ color: COLORS.accent }),
    };
  }

  create(kind: ItemKind): Item {
    const item = this.free[kind].pop() ?? { kind, gfx: new Graphics(this.contexts[kind]) };
    item.gfx.visible = true;
    if (!item.gfx.parent) this.layer.addChild(item.gfx);
    return item;
  }

  release(item: Item) {
    item.gfx.visible = false;
    this.free[item.kind].push(item);
  }

  destroy() {
    for (const ctx of Object.values(this.contexts)) ctx.destroy();
  }
}
