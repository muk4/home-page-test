import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { AGV, COLORS, STROKE } from '../config';
import type { Chest } from './Chest';
import { blackFill, line } from './draw';
import type { Pt } from './geometry';
import type { AgvRouteDef } from './types';

/**
 * The swap cycle of one chest spot:
 * idle → inbound (empty AGV drives in) → lift → outbound (full chest leaves) →
 * away (emptied off-screen) → return (brings it back) → lower → leave → idle.
 */
type SlotPhase = 'idle' | 'inbound' | 'lift' | 'outbound' | 'away' | 'return' | 'lower' | 'leave';

const LIFTED_SCALE = 1.08;
const ease = (t: number) => t * t * (3 - 2 * t);

/** Top view of an AGV facing +x: flat body, wheels at the sides, scanner at the front. */
export function agvContext(T: number): GraphicsContext {
  const s = T * 0.43;
  return new GraphicsContext()
    .rect(-T * 0.2, -s - T * 0.05, T * 0.4, T * 0.1)
    .rect(-T * 0.2, s - T * 0.05, T * 0.4, T * 0.1)
    .fill(blackFill)
    .stroke(line(STROKE.soft, 1))
    .roundRect(-s, -s + T * 0.04, s * 2, s * 2 - T * 0.08, T * 0.1)
    .fill(blackFill)
    .stroke(line(STROKE.strong))
    .circle(0, 0, T * 0.21)
    .stroke(line(STROKE.soft, 1))
    .moveTo(s - T * 0.07, -T * 0.22)
    .lineTo(s - T * 0.07, T * 0.22)
    .stroke(line(STROKE.normal, 1.25))
    .moveTo(T * 0.04, -T * 0.09)
    .lineTo(T * 0.16, 0)
    .lineTo(T * 0.04, T * 0.09)
    .stroke(line(STROKE.soft, 1));
}

/** Signed shortest rotation from `a` to `b`. */
function turn(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * One vehicle. Drives a leg (a polyline of straight runs), stops at every
 * corner and turns on the spot, and when it arrives at a chest it slows to
 * half speed for the last stretch before stopping under it.
 */
class Vehicle {
  readonly view = new Container();
  private readonly beacon = new Graphics();
  x = 0;
  y = 0;
  heading = 0;
  speed = 0;
  done = true;
  private pts: Pt[] = [];
  private seg = 0;
  private along = 0;
  private arriving = false;
  private reverse = false;
  private turning = false;
  private waited = 0;

  constructor(ctx: GraphicsContext, T: number) {
    this.view.addChild(new Graphics(ctx), this.beacon);
    this.beacon.circle(-T * 0.29, 0, T * 0.055).fill({ color: COLORS.accent });
    this.view.visible = false;
  }

  /** Direction the vehicle is actually travelling in (it may back out of a spot). */
  get travel() {
    return this.reverse ? this.heading + Math.PI : this.heading;
  }

  get busy() {
    return !this.done && (this.speed > 0.05 || this.turning);
  }

  /**
   * @param arriving  slow down and stop at the end (at a chest)
   * @param moving    enters already at cruise speed (coming in from off-screen)
   */
  start(pts: Pt[], arriving: boolean, moving: boolean) {
    this.pts = pts;
    this.seg = 0;
    this.along = 0;
    this.arriving = arriving;
    this.done = false;
    this.waited = 0;
    this.x = pts[0].x;
    this.y = pts[0].y;
    const first = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    if (moving) {
      this.heading = first;
      this.speed = AGV.speed;
      this.reverse = false;
    } else {
      this.speed = 0;
      // Backs straight out of a chest spot instead of turning around under it.
      this.reverse = Math.abs(turn(this.heading, first)) > Math.PI * 0.75;
    }
    this.view.visible = true;
  }

  step(dt: number, blocked: (v: Vehicle) => boolean) {
    if (this.done) return;
    const a = this.pts[this.seg];
    const b = this.pts[this.seg + 1];
    const segAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);

    // Turn on the spot until lined up with the next straight run.
    const diff = turn(this.travel, segAngle);
    if (Math.abs(diff) > 1e-3) {
      this.turning = true;
      this.speed = 0;
      const rate = Math.PI / 2 / AGV.pivotTime;
      this.heading += Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
      return;
    }
    this.turning = false;

    const lastSeg = this.seg === this.pts.length - 2;
    const toCorner = segLen - this.along;
    let toEnd = toCorner;
    for (let i = this.seg + 1; i < this.pts.length - 1; i++) {
      toEnd += Math.hypot(this.pts[i + 1].x - this.pts[i].x, this.pts[i + 1].y - this.pts[i].y);
    }

    let target: number = AGV.speed;
    if (this.arriving && toEnd < AGV.slowZone) target = AGV.slowSpeed;
    // Must come to a stop at a corner (to turn) and at the chest.
    if (!lastSeg || this.arriving) target = Math.min(target, Math.max(0.15, Math.sqrt(2 * AGV.decel * toCorner)));
    this.speed = this.speed < target ? Math.min(target, this.speed + AGV.accel * dt) : target;

    if (blocked(this)) {
      this.waited += dt;
      if (this.waited < AGV.maxWait) {
        this.speed = 0;
        return;
      }
    } else {
      this.waited = 0;
    }

    this.along += this.speed * dt;
    if (this.along >= segLen) {
      if (lastSeg) {
        this.x = b.x;
        this.y = b.y;
        this.done = true;
        if (this.arriving) this.speed = 0;
        return;
      }
      this.seg++;
      this.along = 0;
      this.reverse = false;
      this.x = b.x;
      this.y = b.y;
      return;
    }
    const k = this.along / segLen;
    this.x = a.x + (b.x - a.x) * k;
    this.y = a.y + (b.y - a.y) * k;
  }

  render(T: number, time: number) {
    if (!this.view.visible) return;
    this.view.position.set(this.x * T, this.y * T);
    this.view.rotation = this.heading;
    this.beacon.alpha = this.busy ? 0.55 + 0.45 * Math.sin(time * 9) : 0.25;
  }
}

interface Slot {
  chest: Chest;
  /** Lane from the chest (first point) to off-screen (last point), corners only. */
  out: Pt[];
  in: Pt[];
  vehicle: Vehicle;
  phase: SlotPhase;
  t: number;
}

/** All AGVs; every serviced chest spot has its own vehicle and swap cycle. */
export class AgvFleet {
  private readonly slots: Slot[] = [];
  private readonly vehicles: Vehicle[] = [];
  private readonly ctx: GraphicsContext;
  private readonly T: number;

  constructor(routes: AgvRouteDef[], chestAt: (x: number, y: number) => Chest | undefined, layer: Container, T: number) {
    this.T = T;
    this.ctx = agvContext(T);
    for (const route of routes) {
      const chest = chestAt(route.chest.x, route.chest.y);
      if (!chest) continue;
      const out = corners(route.tiles);
      const vehicle = new Vehicle(this.ctx, T);
      layer.addChild(vehicle.view);
      this.vehicles.push(vehicle);
      this.slots.push({ chest, out, in: [...out].reverse(), vehicle, phase: 'idle', t: 0 });
    }
  }

  update(dt: number) {
    for (const slot of this.slots) this.updateSlot(slot, dt);
  }

  private updateSlot(slot: Slot, dt: number) {
    const { chest, vehicle } = slot;
    const blocked = (v: Vehicle) => this.blocked(v);
    switch (slot.phase) {
      case 'idle':
        if (chest.state === 'present' && chest.full) {
          vehicle.start(slot.in, true, true);
          slot.phase = 'inbound';
        }
        break;
      case 'inbound':
        vehicle.step(dt, blocked);
        if (vehicle.done) this.enter(slot, 'lift');
        break;
      case 'lift':
        chest.state = 'carried';
        slot.t = Math.min(1, slot.t + dt / AGV.liftTime);
        chest.view.scale.set(1 + (LIFTED_SCALE - 1) * ease(slot.t));
        if (slot.t >= 1) {
          vehicle.start(slot.out, false, false);
          slot.phase = 'outbound';
        }
        break;
      case 'outbound':
        vehicle.step(dt, blocked);
        this.carry(slot);
        if (vehicle.done) {
          // Emptied somewhere off-screen.
          chest.state = 'away';
          chest.count = 0;
          vehicle.view.visible = false;
          slot.t = AGV.awayMin + Math.random() * (AGV.awayMax - AGV.awayMin);
          slot.phase = 'away';
        }
        break;
      case 'away':
        slot.t -= dt;
        if (slot.t <= 0) {
          chest.state = 'carried';
          vehicle.start(slot.in, true, true);
          slot.phase = 'return';
          this.carry(slot);
        }
        break;
      case 'return':
        vehicle.step(dt, blocked);
        this.carry(slot);
        if (vehicle.done) this.enter(slot, 'lower');
        break;
      case 'lower':
        slot.t = Math.min(1, slot.t + dt / AGV.liftTime);
        chest.view.scale.set(LIFTED_SCALE - (LIFTED_SCALE - 1) * ease(slot.t));
        if (slot.t >= 1) {
          chest.state = 'present';
          chest.home();
          vehicle.start(slot.out, false, false);
          slot.phase = 'leave';
        }
        break;
      case 'leave':
        vehicle.step(dt, blocked);
        if (vehicle.done) {
          vehicle.view.visible = false;
          slot.phase = 'idle';
        }
        break;
    }
  }

  private enter(slot: Slot, phase: SlotPhase) {
    slot.phase = phase;
    slot.t = 0;
  }

  /** The chest rides on top of the vehicle, keeping its own orientation. */
  private carry(slot: Slot) {
    slot.chest.view.position.set(slot.vehicle.x * this.T, slot.vehicle.y * this.T);
    slot.chest.view.scale.set(LIFTED_SCALE);
  }

  /** Another vehicle right ahead in the direction of travel. */
  private blocked(v: Vehicle) {
    const dx = Math.cos(v.travel);
    const dy = Math.sin(v.travel);
    for (const o of this.vehicles) {
      if (o === v || !o.view.visible) continue;
      const ox = o.x - v.x;
      const oy = o.y - v.y;
      const dist = Math.hypot(ox, oy);
      if (dist < AGV.followGap && dist > 1e-3 && (ox * dx + oy * dy) / dist > 0.5) return true;
    }
    return false;
  }

  render(time: number) {
    for (const v of this.vehicles) v.render(this.T, time);
  }

  destroy() {
    this.ctx.destroy();
  }
}

/** Tile chain -> tile-centre polyline with points only at the corners. */
function corners(tiles: { x: number; y: number }[]): Pt[] {
  const c = (t: { x: number; y: number }) => ({ x: t.x + 0.5, y: t.y + 0.5 });
  const pts: Pt[] = [c(tiles[0])];
  for (let i = 1; i < tiles.length - 1; i++) {
    const d1x = tiles[i].x - tiles[i - 1].x;
    const d1y = tiles[i].y - tiles[i - 1].y;
    const d2x = tiles[i + 1].x - tiles[i].x;
    const d2y = tiles[i + 1].y - tiles[i].y;
    if (d1x !== d2x || d1y !== d2y) pts.push(c(tiles[i]));
  }
  pts.push(c(tiles[tiles.length - 1]));
  return pts;
}
