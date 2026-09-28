/** Cardinal direction: 0 = east, 1 = south, 2 = west, 3 = north (screen coordinates). */
export type Dir = 0 | 1 | 2 | 3;

export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;
export const dirAngle = (d: Dir): number => (d * Math.PI) / 2;

export interface Pt {
  x: number;
  y: number;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Sample {
  x: number;
  y: number;
  angle: number;
}

/**
 * Axis-aligned polyline parametrised by arc length `s`.
 * Belts and pipes use it in tile units; renderers scale by the tile size.
 */
export class Path {
  readonly pts: readonly Pt[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: Pt[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      this.cum.push(this.cum[i - 1] + d);
    }
    this.length = this.cum[this.cum.length - 1];
  }

  sample(s: number, out: Sample): Sample {
    const { pts, cum } = this;
    const t = Math.max(0, Math.min(this.length, s));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < t) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const seg = cum[i] - cum[i - 1] || 1;
    const k = (t - cum[i - 1]) / seg;
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.angle = Math.atan2(b.y - a.y, b.x - a.x);
    return out;
  }

  /** The polyline shifted sideways by `d` (positive = left of travel), corners kept square. */
  offset(d: number): Pt[] {
    const { pts } = this;
    const normal = (i: number): Pt => {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: (b.y - a.y) / len, y: -(b.x - a.x) / len };
    };
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (i === 0 || i === pts.length - 1) {
        const n = normal(i === 0 ? 0 : i - 1);
        out.push({ x: p.x + n.x * d, y: p.y + n.y * d });
      } else {
        const n1 = normal(i - 1);
        const n2 = normal(i);
        const same = Math.abs(n1.x - n2.x) < 1e-6 && Math.abs(n1.y - n2.y) < 1e-6;
        out.push(same ? { x: p.x + n1.x * d, y: p.y + n1.y * d } : { x: p.x + (n1.x + n2.x) * d, y: p.y + (n1.y + n2.y) * d });
      }
    }
    return out;
  }
}

/**
 * Builds the centre line of a chain of tiles. `s = i + 0.5` is the centre of
 * tile `i`, so a path through `n` tiles is exactly `n` long.
 * `entry`/`exit` override the edge the path starts/ends at (used by pipes).
 */
export function tilePath(tiles: readonly (Pt & { dir: Dir })[], entry?: Dir): Path {
  const first = tiles[0];
  const inDir = entry ?? first.dir;
  const pts: Pt[] = [{ x: first.x + 0.5 - DX[inDir] * 0.5, y: first.y + 0.5 - DY[inDir] * 0.5 }];
  let prevDir: Dir = inDir;
  for (const t of tiles) {
    if (t.dir !== prevDir) pts.push({ x: t.x + 0.5, y: t.y + 0.5 });
    prevDir = t.dir;
  }
  const last = tiles[tiles.length - 1];
  pts.push({ x: last.x + 0.5 + DX[last.dir] * 0.5, y: last.y + 0.5 + DY[last.dir] * 0.5 });
  return new Path(pts);
}

/** Small deterministic PRNG, so a given viewport always gets the same factory. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
