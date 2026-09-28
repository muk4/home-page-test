import { Graphics, GraphicsContext } from 'pixi.js';
import { SIM, STROKE } from '../config';
import { blackFill, line } from './draw';
import { dirAngle, opposite, type Dir } from './geometry';
import type { Item } from './Item';
import { Machine } from './Machine';
import type { DropPort, PickPort } from './ports';

type Phase = 'pick' | 'toDrop' | 'drop' | 'toPick';

const ARM = 0.92;

export function inserterArmContext(T: number) {
  const L = ARM * T;
  const c = T * 0.1;
  return new GraphicsContext()
    .moveTo(0, 0)
    .lineTo(L * 0.5, -T * 0.06)
    .lineTo(L - c * 0.5, 0)
    .stroke(line(STROKE.strong))
    // claw: two fingers opening towards the item
    .moveTo(L + c * 0.7, -c * 0.9)
    .lineTo(L - c * 0.5, -c * 0.45)
    .lineTo(L - c * 0.5, c * 0.45)
    .lineTo(L + c * 0.7, c * 0.9)
    .stroke(line(STROKE.strong, 1.25))
    .circle(L * 0.5, -T * 0.06, T * 0.05)
    .fill(blackFill)
    .stroke(line(STROKE.soft, 1));
}

/**
 * Inserter: swings between the tile behind it and the tile in front of it.
 * Waits at the pick side until there is something the target wants,
 * then carries it over and waits until the target has room.
 */
export class Inserter extends Machine {
  readonly label = 'Inserter';
  readonly dir: Dir;
  from: PickPort | null = null;
  to: DropPort | null = null;

  private readonly arm: Graphics;
  private readonly pickAngle: number;
  private phase: Phase = 'pick';
  private t = 0;
  private held: Item | null = null;

  constructor(x: number, y: number, dir: Dir, T: number, armCtx: GraphicsContext, phase: number) {
    super(x, y, 1, 1, T);
    this.dir = dir;
    this.pickAngle = dirAngle(opposite(dir));
    const b = T * 0.24;
    this.frame
      .rect(T / 2 - b, T / 2 - b, b * 2, b * 2)
      .fill(blackFill)
      .stroke(line(STROKE.normal))
      .circle(T / 2, T / 2, T * 0.12)
      .stroke(line(STROKE.soft, 1));
    this.arm = new Graphics(armCtx);
    this.arm.position.set(T / 2, T / 2);
    this.arm.rotation = this.pickAngle;
    this.body.addChild(this.arm);
    this.highlight.push(this.arm);
    // Desynchronise neighbours a little.
    this.t = phase * 0.5;
  }

  protected placeLed(led: Graphics) {
    led.position.set(this.T * 0.5, this.T * 0.5);
    led.scale.set(0.8);
  }

  get working() {
    return this.on && this.phase !== 'pick';
  }

  update(dt: number) {
    if (!this.on || !this.from || !this.to) return;
    const to = this.to;
    switch (this.phase) {
      case 'pick': {
        if (this.t > 0) {
          this.t -= dt;
          break;
        }
        const item = this.from.take((k) => to.wants(k));
        if (item) {
          this.held = item;
          this.phase = 'toDrop';
          this.t = 0;
        }
        break;
      }
      case 'toDrop':
        this.t += dt / SIM.inserterSwing;
        if (this.t >= 1) {
          this.t = 1;
          this.phase = 'drop';
        }
        break;
      case 'drop':
        if (this.held && to.canDrop(this.held.kind)) {
          to.drop(this.held);
          this.held = null;
          this.phase = 'toPick';
          this.t = 0;
        }
        break;
      case 'toPick':
        this.t += dt / SIM.inserterSwing;
        if (this.t >= 1) {
          this.t = 0;
          this.phase = 'pick';
        }
        break;
    }
  }

  render(time: number) {
    const ease = (v: number) => v * v * (3 - 2 * v);
    let k = 0;
    let bend = 0;
    if (this.phase === 'toDrop') {
      k = ease(this.t);
      bend = Math.sin(Math.PI * this.t);
    } else if (this.phase === 'drop') {
      k = 1;
    } else if (this.phase === 'toPick') {
      k = 1 - ease(this.t);
      bend = Math.sin(Math.PI * this.t);
    }
    const angle = this.pickAngle + k * Math.PI;
    const reach = 1 - 0.28 * bend;
    this.arm.rotation = angle;
    this.arm.scale.x = reach;
    if (this.held) {
      const T = this.T;
      const r = ARM * T * reach;
      this.held.gfx.position.set((this.x + 0.5) * T + Math.cos(angle) * r, (this.y + 0.5) * T + Math.sin(angle) * r);
    }
    super.renderLed(time);
  }
}
