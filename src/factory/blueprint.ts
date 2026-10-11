import { DX, DY, opposite, type Dir } from './geometry';
import type { BeltDef, DirTile, InserterDef, MachineDef, MachineType, PipeDef } from './types';

/**
 * Blueprint legend (one character per tile):
 *
 *   .        empty
 *   > < ^ v  belt, arrow = direction of travel
 *   e s w n  inserter, letter = direction it drops to (east/south/west/north);
 *            it picks from the opposite side
 *   M        mining drill 2x2 (source) – outputs onto an adjacent belt
 *   F        furnace 2x2 (ore -> plate)
 *   A        assembling machine 3x3 (plates -> gear)
 *   C        chest 1x1 (sink)
 *   T        storage tank 2x2
 *   =        pipe, runs from a tank to the machine at its other end
 */
export interface Blueprint {
  name: string;
  rows: string[];
  /** Only used on phone-sized screens (narrow, tall lines that fit whole). */
  phoneOnly?: boolean;
}

export interface ParsedBlueprint {
  w: number;
  h: number;
  machines: MachineDef[];
  belts: BeltDef[];
  inserters: InserterDef[];
  pipes: PipeDef[];
}

const MACHINES: Record<string, [MachineType, number, number]> = {
  M: ['drill', 2, 2],
  F: ['furnace', 2, 2],
  A: ['assembler', 3, 3],
  C: ['chest', 1, 1],
  T: ['tank', 2, 2],
};

const BELT_DIRS: Record<string, Dir> = { '>': 0, v: 1, '<': 2, '^': 3 };
const INSERTER_DIRS: Record<string, Dir> = { e: 0, s: 1, w: 2, n: 3 };

const H_SWAP: Record<string, string> = { '>': '<', '<': '>', e: 'w', w: 'e' };
const V_SWAP: Record<string, string> = { v: '^', '^': 'v', s: 'n', n: 's' };

const swap = (row: string, table: Record<string, string>) => [...row].map((c) => table[c] ?? c).join('');

export function flipH(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => swap([...r.padEnd(w, '.')].reverse().join(''), H_SWAP));
}

export function flipV(rows: string[]): string[] {
  return [...rows].reverse().map((r) => swap(r, V_SWAP));
}

export function parseBlueprint(rows: string[]): ParsedBlueprint {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (x: number, y: number) => (y >= 0 && y < h && x >= 0 && x < w ? rows[y][x] ?? '.' : '.');
  const key = (x: number, y: number) => y * w + x;

  // Machines: scan for the top-left corner of each footprint.
  const machines: MachineDef[] = [];
  const machineAt = new Map<number, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const spec = MACHINES[at(x, y)];
      if (!spec || machineAt.has(key(x, y))) continue;
      const [type, mw, mh] = spec;
      const id = machines.length;
      for (let yy = y; yy < y + mh; yy++) {
        for (let xx = x; xx < x + mw; xx++) {
          if (at(xx, yy) !== at(x, y)) throw new Error(`Blueprint: broken ${type} footprint at ${x},${y}`);
          machineAt.set(key(xx, yy), id);
        }
      }
      machines.push({ id, type, x, y, w: mw, h: mh });
    }
  }

  // Belts: link each tile to the one feeding it, then walk from the heads.
  const beltDir = new Map<number, Dir>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = BELT_DIRS[at(x, y)];
      if (d !== undefined) beltDir.set(key(x, y), d);
    }
  }
  const feeds = (x: number, y: number, tx: number, ty: number) => {
    const d = beltDir.get(key(x, y));
    return d !== undefined && x + DX[d] === tx && y + DY[d] === ty;
  };
  const predecessor = new Map<number, number>();
  for (const [k, d] of beltDir) {
    const x = k % w;
    const y = Math.floor(k / w);
    const bx = x - DX[d];
    const by = y - DY[d];
    if (feeds(bx, by, x, y)) {
      predecessor.set(k, key(bx, by));
      continue;
    }
    const side = ([0, 1, 2, 3] as Dir[])
      .map((s) => [x + DX[s], y + DY[s]] as const)
      .filter(([sx, sy]) => feeds(sx, sy, x, y));
    if (side.length === 1) predecessor.set(k, key(side[0][0], side[0][1]));
  }
  const belts: BeltDef[] = [];
  for (const [k] of beltDir) {
    if (predecessor.has(k)) continue;
    const tiles: DirTile[] = [];
    let cur = k;
    for (;;) {
      const d = beltDir.get(cur)!;
      const x = cur % w;
      const y = Math.floor(cur / w);
      tiles.push({ x, y, dir: d });
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
      const nk = key(nx, ny);
      if (predecessor.get(nk) !== cur) break;
      cur = nk;
    }
    belts.push({ tiles });
  }

  const inserters: InserterDef[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = INSERTER_DIRS[at(x, y)];
      if (d !== undefined) inserters.push({ x, y, dir: d });
    }
  }

  // Pipes: follow each run that starts next to a tank.
  const pipes: PipeDef[] = [];
  const visited = new Set<number>();
  for (const tank of machines.filter((m) => m.type === 'tank')) {
    for (let y = tank.y - 1; y <= tank.y + tank.h; y++) {
      for (let x = tank.x - 1; x <= tank.x + tank.w; x++) {
        if (at(x, y) !== '=' || visited.has(key(x, y))) continue;
        const entry = ([0, 1, 2, 3] as Dir[]).find((d) => machineAt.get(key(x - DX[d], y - DY[d])) === tank.id);
        if (entry === undefined) continue; // diagonal neighbour
        const tiles: DirTile[] = [];
        let cx = x;
        let cy = y;
        let inDir: Dir = entry;
        let to: number | null = null;
        for (;;) {
          visited.add(key(cx, cy));
          const dirs = ([0, 1, 2, 3] as Dir[]).filter((d) => d !== opposite(inDir));
          const next = dirs.find((d) => at(cx + DX[d], cy + DY[d]) === '=' && !visited.has(key(cx + DX[d], cy + DY[d])));
          if (next !== undefined) {
            tiles.push({ x: cx, y: cy, dir: next });
            cx += DX[next];
            cy += DY[next];
            inDir = next;
            continue;
          }
          const out = dirs.find((d) => {
            const id = machineAt.get(key(cx + DX[d], cy + DY[d]));
            return id !== undefined && id !== tank.id;
          });
          tiles.push({ x: cx, y: cy, dir: out ?? inDir });
          if (out !== undefined) to = machineAt.get(key(cx + DX[out], cy + DY[out]))!;
          break;
        }
        pipes.push({ tiles, entry, from: tank.id, to });
      }
    }
  }

  return { w, h, machines, belts, inserters, pipes };
}
