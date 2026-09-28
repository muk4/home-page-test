import { Graphics } from 'pixi.js';
import { SIM, STROKE } from '../config';
import { blackFill, line } from './draw';
import type { ItemPool } from './Item';
import { Machine } from './Machine';
import type { DropPort } from './ports';

/** Mining drill: the source of every line. Puts ore onto the adjacent belt. */
export class Drill extends Machine {
  readonly label = 'Wiertło';
  output: DropPort | null = null;
  private readonly pool: ItemPool;
  private readonly head = new Graphics();
  private timer: number;
  private blocked = false;

  constructor(x: number, y: number, T: number, pool: ItemPool, phase: number) {
    super(x, y, 2, 2, T);
    this.pool = pool;
    this.timer = phase * SIM.drillPeriod;
    const s = 2 * T;
    const m = T * 0.1;
    this.frame
      .rect(m, m, s - 2 * m, s - 2 * m)
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      .circle(T, T, T * 0.62)
      .stroke(line(STROKE.soft));
    for (const [cx, cy] of [
      [0.3, 0.3],
      [1.7, 1.7],
      [0.3, 1.7],
    ]) {
      this.frame.circle(cx * T, cy * T, T * 0.05).stroke(line(STROKE.soft, 1));
    }
    // Rotor with three blades.
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      this.head.moveTo(0, 0).lineTo(Math.cos(a) * T * 0.5, Math.sin(a) * T * 0.5);
      this.head.moveTo(Math.cos(a) * T * 0.5, Math.sin(a) * T * 0.5).lineTo(Math.cos(a + 0.6) * T * 0.36, Math.sin(a + 0.6) * T * 0.36);
    }
    this.head.stroke(line(STROKE.strong)).circle(0, 0, T * 0.12).fill(blackFill).stroke(line(STROKE.strong));
    this.head.position.set(T, T);
    this.body.addChild(this.head);
    this.highlight.push(this.head);
  }

  get working() {
    return this.on && !this.blocked;
  }

  update(dt: number) {
    if (!this.on || !this.output) return;
    if (this.working) this.head.rotation = (this.head.rotation + dt * 3.2) % (Math.PI * 2);
    this.timer += dt;
    if (this.timer < SIM.drillPeriod) {
      this.blocked = false;
      return;
    }
    if (this.output.canDrop('ore')) {
      this.output.drop(this.pool.create('ore'));
      this.timer -= SIM.drillPeriod;
      this.blocked = false;
    } else {
      this.timer = SIM.drillPeriod;
      this.blocked = true;
    }
  }

  render(time: number) {
    super.renderLed(time);
  }
}
