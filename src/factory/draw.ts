import { COLORS, STROKE } from '../config';

/** Stroke style in the blueprint look: thin white line. */
export const line = (alpha: number = STROKE.normal, width: number = STROKE.width) => ({
  width,
  color: COLORS.line,
  alpha,
  cap: 'round' as const,
  join: 'round' as const,
});

export const accentLine = (alpha = 1, width: number = STROKE.width) => ({
  width,
  color: COLORS.accent,
  alpha,
  cap: 'round' as const,
  join: 'round' as const,
});

export const blackFill = { color: COLORS.bg, alpha: 1 } as const;

/** Flat list of polygon points for a gear outline centred on 0,0. */
export function gearPoints(teeth: number, rOuter: number, rInner: number): number[] {
  const pts: number[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    // root, flank up, tip, flank down
    const corners: [number, number][] = [
      [a, rInner],
      [a + step * 0.18, rOuter],
      [a + step * 0.5, rOuter],
      [a + step * 0.68, rInner],
    ];
    for (const [ang, r] of corners) pts.push(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  return pts;
}
