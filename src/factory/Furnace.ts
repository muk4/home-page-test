import { Graphics, GraphicsContext } from 'pixi.js';
import { SIM, STROKE } from '../config';
import { accentLine, blackFill, line } from './draw';
import type { Item, ItemKind, ItemPool } from './Item';
import { Machine } from './Machine';
import type { DropPort, PickPort } from './ports';

/** Furnace: ore in, plate out. The flame flickers while smelting. */
export class Furnace extends Machine implements DropPort, PickPort {
  readonly label = 'Piec';
  private readonly pool: ItemPool;
  private input = 0;
  private output = 0;
  private progress = 0;
  private smelting = false;
  private readonly flame: Graphics;
  private readonly flames: GraphicsContext[];
  private readonly glow = new Graphics();
  private flicker = 0;

  constructor(x: number, y: number, T: number, pool: ItemPool, flames: GraphicsContext[]) {
    super(x, y, 2, 2, T);
    this.pool = pool;
    this.flames = flames;
    const s = 2 * T;
    const m = T * 0.08;
    this.frame
      .rect(m, m, s - 2 * m, s - 2 * m)
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      // fire box
      .rect(T * 0.45, T * 0.78, T * 1.1, T * 0.9)
      .stroke(line(STROKE.soft))
      // chimney
      .circle(T * 0.48, T * 0.42, T * 0.17)
      .stroke(line(STROKE.soft));
    // vents
    for (let i = 0; i < 3; i++) {
      const y = T * (0.3 + i * 0.13);
      this.frame.moveTo(T * 0.9, y).lineTo(T * 1.5, y);
    }
    this.frame.stroke(line(0.35, 1));
    this.glow.rect(T * 0.47, T * 0.8, T * 1.06, T * 0.86).fill({ color: 0xff9a1f, alpha: 0.1 });
    this.flame = new Graphics(flames[0]);
    this.flame.position.set(T, T * 1.62);
    this.body.addChild(this.glow, this.flame);
  }

  get working() {
    return this.on && this.smelting;
  }

  wants(kind: ItemKind) {
    return kind === 'ore' && this.input < SIM.furnaceInputCap;
  }

  canDrop(kind: ItemKind) {
    return this.wants(kind);
  }

  drop(item: Item) {
    this.pool.release(item);
    this.input++;
  }

  take(accept: (kind: ItemKind) => boolean): Item | null {
    if (this.output <= 0 || !accept('plate')) return null;
    this.output--;
    return this.pool.create('plate');
  }

  update(dt: number) {
    if (!this.on) return;
    this.flicker -= dt;
    if (!this.smelting && this.input > 0 && this.output < SIM.furnaceOutputCap) {
      this.input--;
      this.smelting = true;
      this.progress = 0;
    }
    if (this.smelting) {
      this.progress += dt / SIM.furnaceTime;
      if (this.progress >= 1) {
        this.smelting = false;
        this.output++;
      }
    }
  }

  render(time: number) {
    const active = this.working;
    this.flame.visible = this.on;
    this.glow.visible = active;
    if (this.on && this.flicker <= 0) {
      this.flicker = 0.05 + Math.random() * 0.05;
      this.flame.context = this.flames[Math.floor(Math.random() * this.flames.length)];
      const size = active ? 0.75 + Math.random() * 0.35 : 0.3 + Math.random() * 0.1;
      this.flame.scale.set(active ? 0.9 + Math.random() * 0.2 : 0.7, size);
      this.glow.alpha = 0.6 + Math.random() * 0.4;
    }
    super.renderLed(time);
  }
}

/** A few flame shapes (zig-zag tongues of fire); furnaces flip between them. */
export function flameContexts(T: number): GraphicsContext[] {
  const out: GraphicsContext[] = [];
  for (let v = 0; v < 4; v++) {
    const g = new GraphicsContext();
    const tongues = [-0.28, 0, 0.28];
    tongues.forEach((x0, i) => {
      const h = (i === 1 ? 0.62 : 0.42) + ((v + i) % 3) * 0.06;
      const sway = ((v * 7 + i * 3) % 5) / 5 - 0.4;
      g.moveTo((x0 - 0.1) * T, 0)
        .lineTo((x0 + sway * 0.12) * T, -h * 0.5 * T)
        .lineTo((x0 - 0.04 + sway * 0.1) * T, -h * 0.72 * T)
        .lineTo((x0 + sway * 0.16) * T, -h * T)
        .lineTo((x0 + 0.06) * T, -h * 0.55 * T)
        .lineTo((x0 + 0.1) * T, 0);
    });
    g.stroke(accentLine(0.95, 1.25));
    out.push(g);
  }
  return out;
}
