/** Palette shared by the canvas and CSS (CSS keeps its own copy in style.css). */
export const COLORS = {
  bg: 0x0a0a0a,
  line: 0xffffff,
  accent: 0xff9a1f,
  off: 0xff4d3d,
} as const;

/** Stroke presets: blueprint look, white lines with alpha 0.5–0.8. */
export const STROKE = {
  width: 1.5,
  strong: 0.8,
  normal: 0.65,
  soft: 0.5,
  faint: 0.25,
} as const;

/**
 * Simulation tuning. Rates are chosen so that every stage downstream can
 * consume more than the stage upstream produces: a healthy line keeps
 * flowing and only a switched-off machine makes things pile up.
 */
export const SIM = {
  /** Belt speed in tiles per second. */
  beltSpeed: 1.6,
  /** Minimal distance between item centres on a belt (tiles). */
  itemGap: 0.5,
  /** Time for an inserter to swing half a turn (s). */
  inserterSwing: 0.36,
  /** A mining drill outputs one ore every N seconds. */
  drillPeriod: 1.25,
  furnaceTime: 1.0,
  furnaceInputCap: 2,
  furnaceOutputCap: 2,
  assemblerTime: 1.6,
  /** Plates consumed per assembler craft. */
  assemblerRecipe: 2,
  assemblerInputCap: 4,
  assemblerOutputCap: 2,
  /** Seconds of simulation run before the first frame, so belts are already busy. */
  prewarm: 16,
  /** Largest simulation step; longer frames are split. */
  maxStep: 1 / 30,
} as const;

export const TRAIN = {
  /** Delay before the contact train shows up (s). */
  firstDelayMin: 8,
  firstDelayMax: 12,
  /** Pause between the freight trains that pass later (s). */
  passDelayMin: 16,
  passDelayMax: 28,
  /** Cruise speed in tiles per second. */
  speed: 9,
  accel: 5,
  decel: 4.2,
  /** Contact container footprint, in tiles. */
  cargoLength: 7,
  cargoWidth: 1.75,
} as const;
