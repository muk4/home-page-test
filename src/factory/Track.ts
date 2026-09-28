import type { Graphics } from 'pixi.js';
import { STROKE } from '../config';
import { blackFill, line } from './draw';
import type { LayoutData } from './types';

/** Rails, sleepers, the station platform and the crane runway: all static. */
export function drawTrack(g: Graphics, layout: LayoutData) {
  const T = layout.tile;
  const { station, bounds } = layout;
  const x0 = bounds.x * T;
  const x1 = (bounds.x + bounds.w) * T;
  const cy = station.trackY * T;

  for (let x = Math.floor(bounds.x * 2) / 2; x <= bounds.x + bounds.w; x += 0.5) {
    g.moveTo(x * T + T * 0.25, cy - T * 0.78).lineTo(x * T + T * 0.25, cy + T * 0.78);
  }
  g.stroke(line(0.22, 1));
  for (const off of [-0.44, 0.44]) g.moveTo(x0, cy + off * T).lineTo(x1, cy + off * T);
  g.stroke(line(STROKE.strong));

  // Platform next to the track, a little wider than the container.
  const px0 = (station.centerX - station.cargoLength / 2 - 1.1) * T;
  const px1 = (station.centerX + station.cargoLength / 2 + 1.1) * T;
  const py0 = station.platformRow * T + T * 0.06;
  const py1 = (station.platformRow + 2) * T - T * 0.06;
  g.rect(px0, py0, px1 - px0, py1 - py0).fill(blackFill).stroke(line(STROKE.normal));
  // Safety stripe along the edge of the platform.
  const stripe = py1 - T * 0.16;
  for (let x = px0 + T * 0.1; x < px1 - T * 0.3; x += T * 0.4) g.moveTo(x, stripe).lineTo(x + T * 0.2, stripe);
  g.stroke(line(STROKE.soft, 1));

  // Crane runway: two rails across platform and track.
  const ry0 = station.platformRow * T - T * 0.4;
  const ry1 = cy + T * 1.25;
  for (const cx of [station.craneX0, station.craneX1]) {
    const x = cx * T;
    g.moveTo(x - T * 0.1, ry0).lineTo(x - T * 0.1, ry1).moveTo(x + T * 0.1, ry0).lineTo(x + T * 0.1, ry1);
    g.rect(x - T * 0.2, ry0 - T * 0.1, T * 0.4, T * 0.2).rect(x - T * 0.2, ry1 - T * 0.1, T * 0.4, T * 0.2);
  }
  g.stroke(line(STROKE.normal, 1.25));
}
