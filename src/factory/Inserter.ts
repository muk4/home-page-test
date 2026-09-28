import { Graphics, GraphicsContext } from 'pixi.js';
import { SIM, STROKE } from '../config';
import { blackFill, line } from './draw';
import { dirAngle, opposite, type Dir } from './geometry';
import type { Item } from './Item';
import { Machine } from './Machine';
import type { DropPort, PickPort } from './ports';

type Phase = 'pick' | 'toDrop' | 'drop' | 'toPick';

/** Where an inserter can put things, and the arm angle to reach it. */
export interface InserterTarget {
  port: DropPort;
  angle: number;
}

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
 * Inserter: swings between the tile behind it and the tile in front of it
 * (or a chest beside it). Waits at the pick side until there is something a
 * target wants, then carries it over and waits until the target has room.
 * With two chests it fills one until full, then switches to the other.
 */
export class Inserter extends Machine {
  readonly label = 'Inserter';
  readonly dir: Dir;
  from: PickPort | null = null;
  /** First entry is the tile in front; extra entries are chests beside it. */
  targets: InserterTarget[] = [];

  private readonly arm: Graphics;
  private readonly pickAngle: number;
  private phase: Phase = 'pick';
  private t = 0;
  private held: Item | null = null;
  private target: InserterTarget | null = null;
  /** Index of the target being filled now. */
  private active = 0;
  /** Signed arm rotation from pick to drop for the current swing. */
  private delta = Math.PI;

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
    if (!this.on || !this.from || !this.targets.length) return;
    const swing = SIM.inserterSwing * Math.max(0.5, Math.abs(this.delta) / Math.PI);
    switch (this.phase) {
      case 'pick': {
        if (this.t > 0) {
          this.t -= dt;
          break;
        }
        // Keep filling the current target; move on only when it takes nothing more.
        for (let k = 0; k < this.targets.length; k++) {
          const i = (this.active + k) % this.targets.length;
          const target = this.targets[i];
          const item = this.from.take((kind) => target.port.wants(kind));
          if (!item) continue;
          this.active = i;
          this.held = item;
          this.target = target;
          this.delta = shortestTurn(target.angle - this.pickAngle);
          this.phase = 'toDrop';
          this.t = 0;
          break;
        }
        break;
      }
      case 'toDrop':
        this.t += dt / swing;
        if (this.t >= 1) {
          this.t = 1;
          this.phase = 'drop';
        }
        break;
      case 'drop':
        if (this.held && this.target && this.target.port.canDrop(this.held.kind)) {
          this.target.port.drop(this.held);
          this.held = null;
          this.phase = 'toPick';
          this.t = 0;
        }
        break;
      case 'toPick':
        this.t += dt / swing;
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
    const angle = this.pickAngle + k * this.delta;
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

/** Angle in (-π, π]; a half turn stays +π so straight-through swings keep their old direction. */
function shortestTurn(a: number): number {
  let d = a % (Math.PI * 2);
  if (d <= -Math.PI) d += Math.PI * 2;
  if (d > Math.PI) d -= Math.PI * 2;
  if (Math.abs(Math.abs(d) - Math.PI) < 1e-6) d = Math.PI;
  return d;
}
