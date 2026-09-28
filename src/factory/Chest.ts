import { Container, Graphics } from 'pixi.js';
import { COLORS, STROKE } from '../config';
import { blackFill, line } from './draw';
import type { Item, ItemPool } from './Item';
import type { DropPort } from './ports';

/** Chest: end of a line. Swallows items and blinks when one arrives. */
export class Chest implements DropPort {
  readonly view = new Container();
  private readonly box = new Graphics();
  private readonly pool: ItemPool;
  private flash = 0;
  count = 0;

  constructor(x: number, y: number, T: number, pool: ItemPool) {
    this.pool = pool;
    const m = T * 0.16;
    this.box
      .rect(m, m, T - 2 * m, T - 2 * m)
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      .moveTo(m, T * 0.42)
      .lineTo(T - m, T * 0.42)
      .stroke(line(STROKE.soft, 1))
      .rect(T * 0.42, T * 0.36, T * 0.16, T * 0.14)
      .stroke(line(STROKE.soft, 1));
    this.view.addChild(this.box);
    this.view.position.set(x * T, y * T);
  }

  wants() {
    return true;
  }

  canDrop() {
    return true;
  }

  drop(item: Item) {
    this.pool.release(item);
    this.count++;
    this.flash = 1;
  }

  render(dt: number) {
    if (this.flash <= 0) return;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.box.tint = this.flash > 0 ? COLORS.accent : 0xffffff;
  }
}
