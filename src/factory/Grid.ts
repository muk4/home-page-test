import { Graphics } from 'pixi.js';
import type { TileRect } from './geometry';

/** Background tile grid, drawn once per layout. */
export function drawGrid(bounds: TileRect, T: number): Graphics {
  const g = new Graphics();
  const x0 = bounds.x * T;
  const x1 = (bounds.x + bounds.w) * T;
  const y0 = bounds.y * T;
  const y1 = (bounds.y + bounds.h) * T;
  for (let c = bounds.x; c <= bounds.x + bounds.w; c++) g.moveTo(c * T + 0.5, y0).lineTo(c * T + 0.5, y1);
  for (let r = bounds.y; r <= bounds.y + bounds.h; r++) g.moveTo(x0, r * T + 0.5).lineTo(x1, r * T + 0.5);
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.04 });
  // Every 8th line a touch stronger, like a sheet of blueprint paper.
  for (let c = Math.ceil(bounds.x / 8) * 8; c <= bounds.x + bounds.w; c += 8) g.moveTo(c * T + 0.5, y0).lineTo(c * T + 0.5, y1);
  for (let r = Math.ceil(bounds.y / 8) * 8; r <= bounds.y + bounds.h; r += 8) g.moveTo(x0, r * T + 0.5).lineTo(x1, r * T + 0.5);
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.035 });
  return g;
}
