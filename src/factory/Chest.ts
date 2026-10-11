import { Container, Graphics } from 'pixi.js';
import { AGV, COLORS, SIM, STROKE } from '../config';
import { blackFill, line } from './draw';
import type { Item, ItemKind, ItemPool } from './Item';
import type { DropPort } from './ports';

/** present = on its spot, carried = on an AGV, away = off-screen being emptied. */
export type ChestState = 'present' | 'carried' | 'away';

/**
 * Chest: end of a line. Fills up (the bar inside shows how much); a full
 * chest waits for an AGV. Chests without an AGV lane never fill up.
 */
export class Chest implements DropPort {
  readonly view = new Container();
  readonly x: number;
  readonly y: number;
  private readonly T: number;
  private readonly box = new Graphics();
  private readonly fill = new Graphics();
  private readonly pool: ItemPool;
  private flash = 0;
  /** Swapped by an AGV when full; unserviced chests never fill up. */
  serviced = false;
  /** What this chest has been receiving (sets how much fits in). */
  private kind: ItemKind = 'gear';
  /** Off-screen chest: no AGV lane, it is emptied out of sight once full. */
  hidden = false;
  private swapTimer = 0;
  count = 0;
  state: ChestState = 'present';

  constructor(x: number, y: number, T: number, pool: ItemPool) {
    this.x = x;
    this.y = y;
    this.T = T;
    this.pool = pool;
    const h = T / 2 - T * 0.16;
    this.box
      .rect(-h, -h, h * 2, h * 2)
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      .moveTo(-h, -T * 0.08)
      .lineTo(h, -T * 0.08)
      .stroke(line(STROKE.soft, 1))
      .rect(-T * 0.08, -T * 0.14, T * 0.16, T * 0.14)
      .stroke(line(STROKE.soft, 1));
    // Fill level: the lower part of the chest, growing from the bottom.
    const fh = h - T * 0.08 - 2;
    this.fill.rect(-h + 2, -fh, h * 2 - 4, fh).fill({ color: COLORS.accent, alpha: 0.5 });
    this.fill.position.y = h - 1.5;
    this.fill.scale.y = 0;
    this.view.addChild(this.box, this.fill);
    this.home();
  }

  get capacity() {
    return this.serviced ? SIM.chestCapacity[this.kind] : Infinity;
  }

  get full() {
    return this.count >= this.capacity;
  }

  /** Back on its own tile. */
  home() {
    this.view.position.set((this.x + 0.5) * this.T, (this.y + 0.5) * this.T);
    this.view.scale.set(1);
  }

  wants() {
    return this.state === 'present' && this.count < this.capacity;
  }

  canDrop() {
    return this.wants();
  }

  drop(item: Item) {
    this.kind = item.kind;
    this.pool.release(item);
    this.count++;
    this.flash = 1;
  }

  /** Stands in for the AGV swap of a chest nobody can see, so its pair keeps working. */
  update(dt: number) {
    if (!this.hidden) return;
    if (this.state === 'away') {
      this.swapTimer -= dt;
      if (this.swapTimer <= 0) {
        this.count = 0;
        this.state = 'present';
      }
    } else if (this.full) {
      this.state = 'away';
      this.swapTimer = AGV.hiddenSwapTime;
    }
  }

  render(dt: number) {
    this.view.visible = this.state !== 'away';
    if (this.serviced) this.fill.scale.y = Math.min(1, this.count / this.capacity);
    this.flash = Math.max(0, this.flash - dt * 3);
    // Full chests keep an accent outline until they are picked up.
    this.box.tint = this.flash > 0 || (this.full && this.state === 'present') ? COLORS.accent : 0xffffff;
  }
}
