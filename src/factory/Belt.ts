import { Container, Graphics, GraphicsContext } from 'pixi.js';
import { SIM, STROKE } from '../config';
import { line } from './draw';
import { tilePath, type Path, type Sample } from './geometry';
import type { Item, ItemKind } from './Item';
import type { DropPort, PickPort } from './ports';
import type { DirTile } from './types';

interface BeltItem {
  item: Item;
  s: number;
}

const CHEVRON_SPACING = 0.5;
/** Half width of the belt in tiles. */
const HALF = 0.36;
const tmp: Sample = { x: 0, y: 0, angle: 0 };

/** Shape of a single ">" chevron, shared by all belts. */
export function chevronContext(T: number) {
  const a = T * 0.1;
  return new GraphicsContext()
    .moveTo(-a * 0.6, -a)
    .lineTo(a * 0.6, 0)
    .lineTo(-a * 0.6, a)
    .stroke(line(0.32, 1.25));
}

/**
 * A belt is a queue of items travelling along a tile path. Items keep a
 * minimum gap; the head stops at a dead end (or when the belt it feeds is
 * full), and the ones behind pile up. A belt that is backed up to its start
 * and not moving counts as jammed and its chevrons stop.
 */
export class Belt {
  readonly tiles: DirTile[];
  readonly path: Path;
  readonly length: number;
  /** Sorted head first (largest `s`). */
  readonly items: BeltItem[] = [];
  /** Side-load target when the belt ends against another belt. */
  next: { belt: Belt; s: number } | null = null;

  private readonly T: number;
  private readonly chevrons: Graphics[] = [];
  private phase = 0;
  /** 1 = running, 0 = jammed; eased so the stop and restart are smooth. */
  private flow = 1;

  constructor(tiles: DirTile[], T: number, chevron: GraphicsContext, chevronLayer: Container) {
    this.tiles = tiles;
    this.T = T;
    this.path = tilePath(tiles);
    this.length = this.path.length;
    const n = Math.max(1, Math.round(this.length / CHEVRON_SPACING));
    for (let i = 0; i < n; i++) {
      const g = new Graphics(chevron);
      chevronLayer.addChild(g);
      this.chevrons.push(g);
    }
  }

  drawStatic(g: Graphics) {
    const T = this.T;
    for (const side of [HALF, -HALF]) {
      const pts = this.path.offset(side);
      g.moveTo(pts[0].x * T, pts[0].y * T);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x * T, pts[i].y * T);
    }
    g.stroke(line(STROKE.normal));
    // Tile seams, a bit stronger at both ends.
    for (let i = 0; i <= this.length; i++) {
      this.path.sample(i, tmp);
      const nx = -Math.sin(tmp.angle) * HALF * T;
      const ny = Math.cos(tmp.angle) * HALF * T;
      g.moveTo(tmp.x * T - nx, tmp.y * T - ny).lineTo(tmp.x * T + nx, tmp.y * T + ny);
      g.stroke(line(i === 0 || i === this.length ? STROKE.normal : 0.14, 1));
    }
  }

  tileIndexAt(x: number, y: number): number {
    return this.tiles.findIndex((t) => t.x === x && t.y === y);
  }

  canInsertAt(s: number): boolean {
    if (s < 0 || s > this.length) return false;
    for (const it of this.items) if (Math.abs(it.s - s) < SIM.itemGap - 1e-6) return false;
    return true;
  }

  insert(item: Item, s: number) {
    let i = 0;
    while (i < this.items.length && this.items[i].s > s) i++;
    this.items.splice(i, 0, { item, s });
  }

  take(tileIndex: number, accept: (kind: ItemKind) => boolean): Item | null {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (it.s >= tileIndex && it.s < tileIndex + 1 && accept(it.item.kind)) {
        this.items.splice(i, 1);
        return it.item;
      }
    }
    return null;
  }

  pickPort(tileIndex: number): PickPort {
    return { take: (accept) => this.take(tileIndex, accept) };
  }

  dropPort(tileIndex: number): DropPort {
    const s = tileIndex + 0.5;
    return {
      wants: () => true,
      canDrop: () => this.canInsertAt(s),
      drop: (item) => this.insert(item, s),
    };
  }

  update(dt: number) {
    const step = SIM.beltSpeed * dt;
    const gap = SIM.itemGap;
    const items = this.items;
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let cap: number;
      if (i > 0) {
        cap = items[i - 1].s - gap;
      } else if (this.next) {
        if (it.s + step >= this.length && this.next.belt.canInsertAt(this.next.s)) {
          items.shift();
          this.next.belt.insert(it.item, this.next.s);
          i--;
          moved = true;
          continue;
        }
        cap = this.length;
      } else {
        cap = this.length - gap / 2;
      }
      const ns = Math.min(it.s + step, cap);
      if (ns > it.s + 1e-5) {
        it.s = ns;
        moved = true;
      }
    }
    const jammed = items.length > 0 && !moved && items[items.length - 1].s < 1;
    this.flow += ((jammed ? 0 : 1) - this.flow) * Math.min(1, dt * 7);
    this.phase = (this.phase + SIM.beltSpeed * this.flow * dt) % this.length;
  }

  render() {
    const T = this.T;
    for (const it of this.items) {
      this.path.sample(it.s, tmp);
      it.item.gfx.position.set(tmp.x * T, tmp.y * T);
    }
    const n = this.chevrons.length;
    const spacing = this.length / n;
    for (let i = 0; i < n; i++) {
      const s = (i * spacing + this.phase) % this.length;
      this.path.sample(s, tmp);
      const g = this.chevrons[i];
      g.position.set(tmp.x * T, tmp.y * T);
      g.rotation = tmp.angle;
      g.alpha = Math.min(1, Math.min(s, this.length - s) / 0.2);
    }
  }
}
