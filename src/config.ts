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
  /** Items a chest takes before an AGV swaps it; flat plates stack denser than gears. */
  chestCapacity: { ore: 40, plate: 40, gear: 24 },
  /** Seconds of simulation run before the first frame, so belts are already busy. */
  prewarm: 5,
  /** Largest simulation step; longer frames are split. */
  maxStep: 1 / 30,
} as const;

/** Automated guided vehicles that swap full chests for empty ones. */
export const AGV = {
  /** Cruise speed in tiles per second. */
  speed: 4,
  /** Close to the chest real AGVs slow down: half speed for the last tiles. */
  slowSpeed: 2,
  slowZone: 1.6,
  accel: 5,
  decel: 7,
  /** Seconds for a 90° turn on the spot. */
  pivotTime: 0.3,
  /** Raising or lowering the chest (s). */
  liftTime: 0.5,
  /** Time off-screen before an empty chest comes back (s). */
  awayMin: 1,
  awayMax: 2.2,
  /** A full chest outside the screen is swapped unseen; about as long as a visible swap takes (s). */
  hiddenSwapTime: 4,
  /** Keep this distance (tiles) to the AGV ahead; give up waiting after `maxWait` s. */
  followGap: 1.05,
  maxWait: 2,
} as const;

export const TRAIN = {
  /** Delay before the contact train sets off (s); it then needs a few seconds to arrive. */
  firstDelayMin: 1,
  firstDelayMax: 1,
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
