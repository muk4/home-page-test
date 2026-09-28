import type { Dir, TileRect } from './geometry';

export type MachineType = 'drill' | 'furnace' | 'assembler' | 'chest' | 'tank';

export interface MachineDef {
  id: number;
  type: MachineType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DirTile {
  x: number;
  y: number;
  dir: Dir;
}

/** A belt is a chain of tiles; `dir` is the travel direction when leaving the tile. */
export interface BeltDef {
  tiles: DirTile[];
}

/** An inserter picks from the tile behind it and drops into the tile in front (`dir`). */
export interface InserterDef {
  x: number;
  y: number;
  dir: Dir;
}

/** A pipe run from a tank to one consumer; `entry` is the flow direction into the first tile. */
export interface PipeDef {
  tiles: DirTile[];
  entry: Dir;
  from: number;
  to: number | null;
}

/** Lane of an AGV: from the chest's tile to a tile off-screen (tile centres). */
export interface AgvRouteDef {
  chest: { x: number; y: number };
  tiles: { x: number; y: number }[];
}

export interface PoleDef {
  x: number;
  y: number;
}

export interface StationDef {
  /** Centre of the container in tile units (x). */
  centerX: number;
  /** First tile row of the platform. */
  platformRow: number;
  /** Centre line of the container while it stands on the platform. */
  platformY: number;
  /** Centre line of the track (and of a wagon). */
  trackY: number;
  cargoLength: number;
  cargoWidth: number;
  /** Crane rails (tile units). */
  craneX0: number;
  craneX1: number;
}

/** Everything the factory needs to build itself: pure data, no Pixi objects. */
export interface LayoutData {
  tile: number;
  originX: number;
  originY: number;
  /** Area with tiles, including the part that sticks out of the viewport. */
  bounds: TileRect;
  /** Visible part of the grid. */
  view: TileRect;
  /** Calm zone under the text; no machines there. */
  content: TileRect;
  station: StationDef;
  belts: BeltDef[];
  machines: MachineDef[];
  inserters: InserterDef[];
  pipes: PipeDef[];
  poles: PoleDef[];
  agvRoutes: AgvRouteDef[];
}
