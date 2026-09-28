import type { Item, ItemKind } from './Item';

/** Something an inserter can take items from (a belt tile, a machine's output). */
export interface PickPort {
  take(accept: (kind: ItemKind) => boolean): Item | null;
}

/** Something an inserter or drill can put items into. */
export interface DropPort {
  /** Would this port ever take this kind right now (used to decide what to pick)? */
  wants(kind: ItemKind): boolean;
  canDrop(kind: ItemKind): boolean;
  drop(item: Item): void;
}
