import { TRAIN } from '../config';
import { flipH, flipV, parseBlueprint, type ParsedBlueprint } from './blueprint';
import { BLUEPRINTS } from './blueprints';
import { mulberry32, type TileRect } from './geometry';
import type { LayoutData, MachineDef, PoleDef } from './types';

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LayoutInput {
  width: number;
  height: number;
  /** Tile size in CSS px (from the --tile custom property). */
  tile: number;
  /** Heading + paragraph. */
  intro: ScreenRect;
  /** Slot reserved in the HTML flow for the platform and the track. */
  station: ScreenRect;
}

/** How far (in tiles) the factory may stick out of the viewport. */
const OVERFLOW = 2;
/** A line may end this many tiles past the outer (off-screen) edge of its region. */
const OUTER_SLACK = 6;

type Anchor = 'top' | 'bottom' | 'left' | 'right';

interface Region extends TileRect {
  /** Side facing the text: lines are packed starting from there. */
  anchor: Anchor;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Parsed blueprints, grouped by height, with every mirror variant. */
function catalogue() {
  const byHeight = new Map<number, { name: string; variants: ParsedBlueprint[] }[]>();
  for (const bp of BLUEPRINTS) {
    const variants = [bp.rows, flipH(bp.rows), flipV(bp.rows), flipV(flipH(bp.rows))].map(parseBlueprint);
    const h = variants[0].h;
    if (!byHeight.has(h)) byHeight.set(h, []);
    byHeight.get(h)!.push({ name: bp.name, variants });
  }
  return byHeight;
}

let cachedCatalogue: ReturnType<typeof catalogue> | null = null;

export function computeLayout(input: LayoutInput): LayoutData {
  const { width, height } = input;
  const T = input.tile;
  const rng = mulberry32(Math.round(width) * 7919 + Math.round(height) * 104729);
  const cat = (cachedCatalogue ??= catalogue());

  // Anchor the grid on the station: container centred on a tile, platform on a row.
  const stationCx = (input.station.left + input.station.right) / 2;
  const originX = mod(stationCx - T / 2, T) - T;
  const originY = mod(input.station.top, T) - T;
  const sc = Math.round((stationCx - T / 2 - originX) / T);
  const platformRow = Math.round((input.station.top - originY) / T);

  const cols = Math.ceil((width - originX) / T);
  const rows = Math.ceil((height - originY) / T);
  const view: TileRect = { x: 0, y: 0, w: cols, h: rows };
  const bounds: TileRect = { x: -OVERFLOW, y: -OVERFLOW, w: cols + OVERFLOW * 2, h: rows + OVERFLOW * 2 };

  const cargoLength = TRAIN.cargoLength;
  const centerX = sc + 0.5;
  const station = {
    centerX,
    platformRow,
    platformY: platformRow + 1,
    trackY: platformRow + 3,
    cargoLength,
    cargoWidth: TRAIN.cargoWidth,
    craneX0: centerX - cargoLength / 2 - 0.75,
    craneX1: centerX + cargoLength / 2 + 0.75,
  };

  // Calm zone: the text plus one tile of margin, down to the platform.
  const toCol = (px: number) => (px - originX) / T;
  const toRow = (px: number) => (px - originY) / T;
  const cx0 = Math.min(Math.floor(toCol(input.intro.left)), Math.floor(station.craneX0)) - 1;
  const cx1 = Math.max(Math.ceil(toCol(input.intro.right)), Math.ceil(station.craneX1)) + 1;
  const cy0 = Math.floor(toRow(input.intro.top)) - 1;
  const content: TileRect = { x: cx0, y: cy0, w: cx1 - cx0, h: platformRow + 2 - cy0 };

  // Rows platformRow+2 .. +3 hold the track, one spare row below it.
  const trackTop = platformRow + 2;
  const bottomStart = platformRow + 5;
  const x0 = bounds.x;
  const x1 = bounds.x + bounds.w;
  const y1 = bounds.y + bounds.h;
  const regions: Region[] = [
    { x: x0, y: bounds.y, w: x1 - x0, h: cy0 - 1 - bounds.y, anchor: 'bottom' },
    { x: x0, y: bottomStart, w: x1 - x0, h: y1 - bottomStart, anchor: 'top' },
    { x: x0, y: cy0, w: cx0 - x0, h: trackTop - 1 - cy0, anchor: 'right' },
    { x: cx1, y: cy0, w: x1 - cx1, h: trackTop - 1 - cy0, anchor: 'left' },
  ];

  const layout: LayoutData = {
    tile: T,
    originX,
    originY,
    bounds,
    view,
    content,
    station,
    belts: [],
    machines: [],
    inserters: [],
    pipes: [],
    poles: [],
  };

  const allHeights = [...cat.keys()].sort((a, b) => b - a);
  const minHeight = allHeights[allHeights.length - 1];

  for (const region of regions) {
    if (region.w < 8 || region.h < minHeight) continue;
    const vertical = region.anchor === 'top' || region.anchor === 'bottom';
    // Only shelf heights that have at least one line narrow enough for this region.
    const heights = allHeights.filter((h) => cat.get(h)!.some((o) => o.variants[0].w <= region.w + OUTER_SLACK));
    // Shelves are stacked away from the text: the lines closest to it are always complete.
    // Full shelves go into the visible rows first; one more may be cut by the screen edge.
    const hidden = vertical ? OVERFLOW : 0;
    let visible = region.h - hidden;
    let used = 0;
    let shelfIndex = 0;
    for (;;) {
      let fitting = heights.filter((h) => h <= visible);
      if (!fitting.length) {
        fitting = heights.filter((h) => h <= visible + hidden).reverse();
        if (!fitting.length || visible < 1) break;
      }
      // Mostly the tallest shelf that fits, sometimes a lower one for variety.
      const h = fitting.length > 1 && rng() < 0.3 ? fitting[1] : fitting[0];
      const shelfY = region.anchor === 'bottom' ? region.y + region.h - used - h : region.y + used;
      const options = [...cat.entries()].filter(([bh]) => bh <= h).flatMap(([, list]) => list);
      packShelf(layout, options, region, shelfY, h, rng, vertical, shelfIndex++);
      used += h + 1;
      visible -= h + 1;
    }
  }

  layout.poles = placePoles(layout, rng);
  return layout;
}

type Option = { name: string; variants: ParsedBlueprint[] };

/**
 * Fills one shelf (a band `height` rows tall) with columns of lines. A column
 * holds one line or a few lower ones stacked; the stack starts at the side
 * facing the text.
 */
function packShelf(
  layout: LayoutData,
  options: Option[],
  region: Region,
  y: number,
  height: number,
  rng: () => number,
  fullWidth: boolean,
  shelfIndex: number,
) {
  const fromRight = region.anchor === 'right';
  const stackUp = region.anchor === 'bottom';
  // Wide bands start slightly off-screen at a random offset, so rows don't line up.
  let cursor = fullWidth ? region.x - Math.floor(rng() * 4) - (shelfIndex % 2) * 3 : fromRight ? region.x + region.w : region.x;
  const limit = fromRight ? region.x : region.x + region.w;
  const minH = Math.min(...options.map((o) => o.variants[0].h));
  let last = '';

  const choose = (maxW: number, maxH: number, preferTall: boolean): Option | null => {
    const fit = options.filter((o) => o.variants[0].w <= maxW && o.variants[0].h <= maxH);
    if (!fit.length) return null;
    const score = (o: Option) => o.variants[0].w * (preferTall ? o.variants[0].h : 1);
    const best = Math.max(...fit.map(score));
    const good = fit.filter((o) => score(o) >= best * 0.6);
    const fresh = good.filter((o) => o.name !== last);
    const pool = fresh.length ? fresh : good;
    const pick = pool[Math.floor(rng() * pool.length)];
    last = pick.name;
    return pick;
  };

  for (;;) {
    const room = fromRight ? cursor - limit : limit - cursor;
    // May run past the outer edge (it's off-screen there), never into the text.
    const first = choose(room + OUTER_SLACK, height, true);
    if (!first) break;
    const colW = first.variants[0].w;
    const x0 = fromRight ? cursor - colW : cursor;
    let offset = 0;
    let option: Option | null = first;
    while (option) {
      const bp = option.variants[Math.floor(rng() * 4)];
      const bx = fromRight ? x0 + colW - bp.w : x0;
      const by = stackUp ? y + height - offset - bp.h : y + offset;
      place(layout, bp, bx, by);
      offset += bp.h + 1;
      option = height - offset >= minH ? choose(colW, height - offset, false) : null;
    }
    const gap = 1 + Math.floor(rng() * 2);
    cursor = fromRight ? x0 - gap : x0 + colW + gap;
  }
}

function place(layout: LayoutData, bp: ParsedBlueprint, ox: number, oy: number) {
  const idBase = layout.machines.length;
  for (const m of bp.machines) layout.machines.push({ ...m, id: idBase + m.id, x: m.x + ox, y: m.y + oy });
  for (const b of bp.belts) layout.belts.push({ tiles: b.tiles.map((t) => ({ ...t, x: t.x + ox, y: t.y + oy })) });
  for (const i of bp.inserters) layout.inserters.push({ ...i, x: i.x + ox, y: i.y + oy });
  for (const p of bp.pipes) {
    layout.pipes.push({
      tiles: p.tiles.map((t) => ({ ...t, x: t.x + ox, y: t.y + oy })),
      entry: p.entry,
      from: idBase + p.from,
      to: p.to === null ? null : idBase + p.to,
    });
  }
}

/** Power poles on free tiles, roughly on a lattice: cheap density, drawn once. */
function placePoles(layout: LayoutData, rng: () => number): PoleDef[] {
  const taken = new Set<string>();
  const mark = (x: number, y: number) => taken.add(`${x},${y}`);
  const markRect = (m: Pick<MachineDef, 'x' | 'y' | 'w' | 'h'>) => {
    for (let y = m.y; y < m.y + m.h; y++) for (let x = m.x; x < m.x + m.w; x++) mark(x, y);
  };
  layout.machines.forEach(markRect);
  layout.belts.forEach((b) => b.tiles.forEach((t) => mark(t.x, t.y)));
  layout.pipes.forEach((p) => p.tiles.forEach((t) => mark(t.x, t.y)));
  layout.inserters.forEach((i) => mark(i.x, i.y));
  const { content, station, bounds } = layout;
  const inContent = (x: number, y: number) =>
    x >= content.x - 1 && x < content.x + content.w + 1 && y >= content.y - 1 && y < content.y + content.h + 1;
  const nearTrack = (y: number) => y >= station.platformRow + 1 && y <= station.platformRow + 4;

  const poles: PoleDef[] = [];
  const stepX = 7;
  const stepY = 5;
  for (let row = 0, gy = bounds.y + 1; gy < bounds.y + bounds.h; row++, gy += stepY) {
    for (let gx = bounds.x + 1 + (row % 2) * 3; gx < bounds.x + bounds.w; gx += stepX) {
      // Try a few spots around the lattice point.
      for (let attempt = 0; attempt < 6; attempt++) {
        const x = gx + Math.floor(rng() * 3) - 1;
        const y = gy + Math.floor(rng() * 3) - 1;
        if (taken.has(`${x},${y}`) || inContent(x, y) || nearTrack(y)) continue;
        poles.push({ x, y });
        mark(x, y);
        break;
      }
    }
  }
  return poles;
}
