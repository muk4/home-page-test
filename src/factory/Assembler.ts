import { Graphics } from 'pixi.js';
import { COLORS, SIM, STROKE } from '../config';
import { blackFill, gearPoints, line } from './draw';
import type { Item, ItemKind, ItemPool } from './Item';
import { Machine } from './Machine';
import type { DropPort, PickPort } from './ports';

/** Assembling machine 3x3: two plates make a gear. Gear spins, bar shows progress. */
export class Assembler extends Machine implements DropPort, PickPort {
  readonly label = 'Maszyna montażowa';
  private readonly pool: ItemPool;
  private input = 0;
  private output = 0;
  private progress = 0;
  private crafting = false;
  private readonly gear = new Graphics();
  private readonly bar = new Graphics();
  private readonly barH: number;

  constructor(x: number, y: number, T: number, pool: ItemPool) {
    super(x, y, 3, 3, T);
    this.pool = pool;
    const s = 3 * T;
    const m = T * 0.1;
    const i = T * 0.34;
    this.frame
      .rect(m, m, s - 2 * m, s - 2 * m)
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      .rect(i, i, s - 2 * i, s - 2 * i)
      .stroke(line(0.3, 1));
    // corner brackets
    const c = T * 0.22;
    for (const [x0, y0, sx, sy] of [
      [m, m, 1, 1],
      [s - m, m, -1, 1],
      [m, s - m, 1, -1],
      [s - m, s - m, -1, -1],
    ]) {
      this.frame.moveTo(x0 + sx * c * 2.2, y0 + sy * c).lineTo(x0 + sx * c, y0 + sy * c).lineTo(x0 + sx * c, y0 + sy * c * 2.2);
    }
    this.frame.stroke(line(STROKE.soft, 1));

    // progress bar next to the gear
    const bx = T * 2.36;
    const by = T * 0.62;
    const bw = T * 0.24;
    this.barH = T * 1.76;
    this.frame.rect(bx, by, bw, this.barH).stroke(line(STROKE.soft, 1));
    this.bar.rect(0, -this.barH + 3, bw - 4, this.barH - 4).fill({ color: COLORS.accent, alpha: 0.9 });
    this.bar.position.set(bx + 2, by + this.barH - 1);
    this.bar.scale.y = 0;

    const r = T * 0.78;
    this.gear
      .poly(gearPoints(10, r, r * 0.8))
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      .circle(0, 0, r * 0.52)
      .stroke(line(STROKE.soft, 1))
      .circle(0, 0, r * 0.16)
      .stroke(line(STROKE.strong));
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      this.gear.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16).lineTo(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52);
    }
    this.gear.stroke(line(STROKE.soft, 1));
    this.gear.position.set(T * 1.32, T * 1.5);
    this.body.addChild(this.gear, this.bar);
    this.highlight.push(this.gear);
  }

  get working() {
    return this.on && this.crafting;
  }

  wants(kind: ItemKind) {
    return kind === 'plate' && this.input < SIM.assemblerInputCap;
  }

  canDrop(kind: ItemKind) {
    return this.wants(kind);
  }

  drop(item: Item) {
    this.pool.release(item);
    this.input++;
  }

  take(accept: (kind: ItemKind) => boolean): Item | null {
    if (this.output <= 0 || !accept('gear')) return null;
    this.output--;
    return this.pool.create('gear');
  }

  update(dt: number) {
    if (!this.on) return;
    if (!this.crafting && this.input >= SIM.assemblerRecipe && this.output < SIM.assemblerOutputCap) {
      this.input -= SIM.assemblerRecipe;
      this.crafting = true;
      this.progress = 0;
    }
    if (this.crafting) {
      this.gear.rotation = (this.gear.rotation + dt * 2) % (Math.PI * 2);
      this.progress += dt / SIM.assemblerTime;
      if (this.progress >= 1) {
        this.progress = 0;
        this.crafting = false;
        this.output++;
      }
    }
  }

  render(time: number) {
    this.bar.scale.y = this.progress;
    super.renderLed(time);
  }
}
