import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { STROKE } from '../config';
import { blackFill, line } from './draw';
import { tilePath, type Path, type Sample } from './geometry';
import type { Machine } from './Machine';
import type { MachineDef, PipeDef } from './types';

const HALF = 0.15;
const DASH_SPACING = 0.5;
const FLOW_SPEED = 1.3;
const tmp: Sample = { x: 0, y: 0, angle: 0 };

export function pipeDashContext(T: number) {
  const d = T * 0.11;
  return new GraphicsContext().moveTo(-d, 0).lineTo(d, 0).stroke(line(0.9, 1.5));
}

/** Storage tank 2x2, static. */
export function drawTank(g: Graphics, m: MachineDef, T: number) {
  const cx = (m.x + 1) * T;
  const cy = (m.y + 1) * T;
  g.rect(m.x * T + T * 0.12, m.y * T + T * 0.12, T * 1.76, T * 1.76).fill(blackFill).stroke(line(0.35, 1));
  g.circle(cx, cy, T * 0.8).fill(blackFill).stroke(line(STROKE.strong));
  g.circle(cx, cy, T * 0.52).stroke(line(STROKE.soft, 1));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    g.moveTo(cx + Math.cos(a) * T * 0.52, cy + Math.sin(a) * T * 0.52).lineTo(cx + Math.cos(a) * T * 0.8, cy + Math.sin(a) * T * 0.8);
  }
  g.stroke(line(STROKE.soft, 1));
  g.circle(cx, cy, T * 0.1).stroke(line(STROKE.soft, 1));
}

/**
 * A pipe run from a tank to a machine. The flow is a dashed line whose
 * offset travels towards the consumer; it stops when the consumer is off.
 */
export class PipeRun {
  readonly path: Path;
  private readonly T: number;
  private readonly consumer: Machine | null;
  private readonly dashes: Graphics[] = [];
  private phase = 0;
  private flow = 1;

  constructor(def: PipeDef, T: number, consumer: Machine | null, dash: GraphicsContext, layer: Container) {
    this.T = T;
    this.consumer = consumer;
    this.path = tilePath(def.tiles, def.entry);
    const n = Math.max(1, Math.round(this.path.length / DASH_SPACING));
    for (let i = 0; i < n; i++) {
      const g = new Graphics(dash);
      layer.addChild(g);
      this.dashes.push(g);
    }
  }

  drawStatic(g: Graphics) {
    const T = this.T;
    for (const side of [HALF, -HALF]) {
      const pts = this.path.offset(side);
      g.moveTo(pts[0].x * T, pts[0].y * T);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x * T, pts[i].y * T);
    }
    g.stroke(line(STROKE.strong));
    // flanges at every joint
    for (let i = 0; i <= this.path.length; i++) {
      this.path.sample(i, tmp);
      const nx = -Math.sin(tmp.angle) * T * 0.24;
      const ny = Math.cos(tmp.angle) * T * 0.24;
      const ax = Math.cos(tmp.angle) * T * 0.04;
      const ay = Math.sin(tmp.angle) * T * 0.04;
      g.moveTo(tmp.x * T - nx - ax, tmp.y * T - ny - ay)
        .lineTo(tmp.x * T + nx - ax, tmp.y * T + ny - ay)
        .moveTo(tmp.x * T - nx + ax, tmp.y * T - ny + ay)
        .lineTo(tmp.x * T + nx + ax, tmp.y * T + ny + ay);
    }
    g.stroke(line(STROKE.soft, 1));
  }

  update(dt: number) {
    const target = this.consumer && !this.consumer.on ? 0 : 1;
    this.flow += (target - this.flow) * Math.min(1, dt * 3);
    this.phase = (this.phase + FLOW_SPEED * this.flow * dt) % this.path.length;
  }

  render(time: number) {
    const T = this.T;
    const n = this.dashes.length;
    const spacing = this.path.length / n;
    for (let i = 0; i < n; i++) {
      const s = (i * spacing + this.phase) % this.path.length;
      this.path.sample(s, tmp);
      const g = this.dashes[i];
      g.position.set(tmp.x * T, tmp.y * T);
      g.rotation = tmp.angle;
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 - s * 2.4);
      const edge = Math.min(1, Math.min(s, this.path.length - s) / 0.15);
      g.alpha = edge * (0.2 + this.flow * (0.25 + 0.45 * pulse));
    }
  }
}
