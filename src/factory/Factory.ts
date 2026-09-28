import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
import { SIM, STROKE } from '../config';
import { Assembler } from './Assembler';
import { Belt, chevronContext } from './Belt';
import { Chest } from './Chest';
import { line } from './draw';
import { Drill } from './Drill';
import { Furnace, flameContexts } from './Furnace';
import { DX, DY, mulberry32 } from './geometry';
import { drawGrid } from './Grid';
import { Inserter, inserterArmContext } from './Inserter';
import { ItemPool } from './Item';
import type { Machine } from './Machine';
import { drawTank, PipeRun, pipeDashContext } from './Pipe';
import type { DropPort, PickPort } from './ports';
import { drawTrack } from './Track';
import type { LayoutData } from './types';

export interface FactoryHooks {
  /** Pointer entered (machine) or left (null) a machine. */
  hover(machine: Machine | null, x: number, y: number): void;
  move(x: number, y: number): void;
  toggled(machine: Machine, touch: boolean): void;
}

type Entity = Machine | Chest | 'tank';

/** Builds the whole factory from layout data and runs the simulation. */
export class Factory {
  readonly root = new Container();
  readonly layout: LayoutData;
  /** Layer for the train and the crane (filled by Train). */
  readonly trainLayer = new Container();

  private readonly pool: ItemPool;
  private readonly belts: Belt[] = [];
  private readonly machines: Machine[] = [];
  private readonly chests: Chest[] = [];
  private readonly pipes: PipeRun[] = [];
  private readonly disposables: { destroy(): void }[] = [];
  private time = 0;

  constructor(layout: LayoutData, hooks: FactoryHooks) {
    this.layout = layout;
    const T = layout.tile;
    const rng = mulberry32(layout.view.w * 31 + layout.view.h);
    this.root.position.set(Math.round(layout.originX), Math.round(layout.originY));

    const ground = new Graphics();
    const chevronLayer = new Container();
    const flowLayer = new Container();
    const itemLayer = new Container();
    const machineLayer = new Container();
    const inserterLayer = new Container();
    for (const passive of [chevronLayer, flowLayer, itemLayer, ground]) {
      passive.eventMode = 'none';
      passive.interactiveChildren = false;
    }
    this.trainLayer.eventMode = 'none';
    this.root.addChild(drawGrid(layout.bounds, T), ground, chevronLayer, flowLayer, itemLayer, machineLayer, inserterLayer, this.trainLayer);

    const chevron = chevronContext(T);
    const flames = flameContexts(T);
    const arm = inserterArmContext(T);
    const dash = pipeDashContext(T);
    this.disposables.push(chevron, arm, dash, ...flames);
    this.pool = new ItemPool(itemLayer, T);

    const key = (x: number, y: number) => `${x},${y}`;

    // Belts
    const beltAt = new Map<string, [Belt, number]>();
    for (const def of layout.belts) {
      const belt = new Belt(def.tiles, T, chevron, chevronLayer);
      this.belts.push(belt);
      def.tiles.forEach((t, i) => beltAt.set(key(t.x, t.y), [belt, i]));
    }
    for (const belt of this.belts) {
      const last = belt.tiles[belt.tiles.length - 1];
      const hit = beltAt.get(key(last.x + DX[last.dir], last.y + DY[last.dir]));
      if (hit && hit[0] !== belt) belt.next = { belt: hit[0], s: hit[1] + 0.5 };
    }

    // Machines
    const entityAt = new Map<string, Entity>();
    const byId = new Map<number, Entity>();
    for (const def of layout.machines) {
      let entity: Entity;
      switch (def.type) {
        case 'drill': {
          const drill = new Drill(def.x, def.y, T, this.pool, rng());
          drill.output = this.drillOutput(def, beltAt);
          entity = drill;
          this.drawOrePatch(ground, def, entityAt, rng);
          break;
        }
        case 'furnace':
          entity = new Furnace(def.x, def.y, T, this.pool, flames);
          break;
        case 'assembler':
          entity = new Assembler(def.x, def.y, T, this.pool);
          break;
        case 'chest':
          entity = new Chest(def.x, def.y, T, this.pool);
          this.chests.push(entity);
          machineLayer.addChild(entity.view);
          break;
        case 'tank':
          entity = 'tank';
          drawTank(ground, def, T);
          break;
      }
      if (entity !== 'tank' && !(entity instanceof Chest)) {
        this.machines.push(entity);
        machineLayer.addChild(entity.view);
      }
      byId.set(def.id, entity);
      for (let y = def.y; y < def.y + def.h; y++) for (let x = def.x; x < def.x + def.w; x++) entityAt.set(key(x, y), entity);
    }

    // Inserters, wired to whatever sits behind and in front of them.
    for (const def of layout.inserters) {
      const ins = new Inserter(def.x, def.y, def.dir, T, arm, rng());
      const px = def.x - DX[def.dir];
      const py = def.y - DY[def.dir];
      const qx = def.x + DX[def.dir];
      const qy = def.y + DY[def.dir];
      const pb = beltAt.get(key(px, py));
      const qb = beltAt.get(key(qx, qy));
      const pe = entityAt.get(key(px, py));
      const qe = entityAt.get(key(qx, qy));
      ins.from = pb ? pb[0].pickPort(pb[1]) : pe instanceof Furnace || pe instanceof Assembler ? (pe as PickPort) : null;
      ins.to = qb
        ? qb[0].dropPort(qb[1])
        : qe instanceof Furnace || qe instanceof Assembler || qe instanceof Chest
          ? (qe as DropPort)
          : null;
      this.machines.push(ins);
      inserterLayer.addChild(ins.view);
    }

    for (const def of layout.pipes) {
      const consumer = def.to === null ? null : byId.get(def.to);
      const run = new PipeRun(def, T, consumer && consumer !== 'tank' && !(consumer instanceof Chest) ? consumer : null, dash, flowLayer);
      run.drawStatic(ground);
      this.pipes.push(run);
    }

    for (const belt of this.belts) belt.drawStatic(ground);
    this.drawPoles(ground);
    drawTrack(ground, layout);

    for (const m of this.machines) {
      m.view.on('pointerover', (e: FederatedPointerEvent) => {
        m.setHover(true);
        hooks.hover(m, e.global.x, e.global.y);
      });
      m.view.on('pointerout', (e: FederatedPointerEvent) => {
        m.setHover(false);
        if (e.pointerType === 'mouse') hooks.hover(null, 0, 0);
      });
      m.view.on('pointermove', (e: FederatedPointerEvent) => hooks.move(e.global.x, e.global.y));
      m.view.on('pointertap', (e: FederatedPointerEvent) => {
        m.toggle();
        hooks.toggled(m, e.pointerType !== 'mouse');
      });
    }
  }

  /** Screen position (CSS px) of a point given in tile units. */
  toScreen(x: number, y: number) {
    return { x: this.root.x + x * this.layout.tile, y: this.root.y + y * this.layout.tile };
  }

  /** Runs the simulation for a while without drawing, so the first frame is already busy. */
  prewarm(seconds: number) {
    const step = SIM.maxStep;
    for (let t = 0; t < seconds; t += step) this.step(step);
    this.render(0);
  }

  update(dt: number) {
    let left = dt;
    while (left > 1e-6) {
      const step = Math.min(left, SIM.maxStep);
      this.step(step);
      left -= step;
    }
    this.render(dt);
  }

  private step(dt: number) {
    this.time += dt;
    for (const m of this.machines) m.update(dt);
    for (const b of this.belts) b.update(dt);
    for (const p of this.pipes) p.update(dt);
  }

  private render(dt: number) {
    for (const b of this.belts) b.render();
    for (const m of this.machines) m.render(this.time);
    for (const p of this.pipes) p.render(this.time);
    for (const c of this.chests) c.render(dt);
  }

  destroy() {
    this.root.destroy({ children: true });
    this.pool.destroy();
    for (const d of this.disposables) d.destroy();
  }

  /** Drills drop ore onto the most upstream belt tile next to them. */
  private drillOutput(def: LayoutData['machines'][number], beltAt: Map<string, [Belt, number]>): DropPort | null {
    let best: [Belt, number] | null = null;
    for (let y = def.y - 1; y <= def.y + def.h; y++) {
      for (let x = def.x - 1; x <= def.x + def.w; x++) {
        const inside = x >= def.x && x < def.x + def.w && y >= def.y && y < def.y + def.h;
        const corner = (x === def.x - 1 || x === def.x + def.w) && (y === def.y - 1 || y === def.y + def.h);
        if (inside || corner) continue;
        const hit = beltAt.get(`${x},${y}`);
        if (hit && (!best || hit[1] < best[1])) best = hit;
      }
    }
    return best ? best[0].dropPort(best[1]) : null;
  }

  /** A few rocks around a drill, so it visibly sits on an ore field. */
  private drawOrePatch(g: Graphics, def: LayoutData['machines'][number], taken: Map<string, Entity>, rng: () => number) {
    const T = this.layout.tile;
    for (let i = 0; i < 9; i++) {
      const x = def.x - 1 + rng() * (def.w + 2);
      const y = def.y - 1 + rng() * (def.h + 2);
      if (x > def.x - 0.2 && x < def.x + def.w + 0.2 && y > def.y - 0.2 && y < def.y + def.h + 0.2) continue;
      if (taken.has(`${Math.floor(x)},${Math.floor(y)}`)) continue;
      const r = T * (0.05 + rng() * 0.06);
      const pts: number[] = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + rng() * 0.6;
        const rr = r * (0.7 + rng() * 0.5);
        pts.push(x * T + Math.cos(a) * rr, y * T + Math.sin(a) * rr);
      }
      g.poly(pts).stroke(line(0.22, 1));
    }
  }

  private drawPoles(g: Graphics) {
    const T = this.layout.tile;
    const poles = this.layout.poles;
    // Wires first, so the poles sit on top of them.
    for (const p of poles) {
      const right = poles
        .filter((q) => q.x > p.x && q.x - p.x <= 9 && Math.abs(q.y - p.y) <= 3)
        .sort((a, b) => a.x - p.x - (b.x - p.x))[0];
      const below = poles
        .filter((q) => q.y > p.y && q.y - p.y <= 7 && Math.abs(q.x - p.x) <= 3)
        .sort((a, b) => a.y - p.y - (b.y - p.y))[0];
      for (const q of [right, below]) {
        if (!q) continue;
        const ax = (p.x + 0.5) * T;
        const ay = (p.y + 0.5) * T;
        const bx = (q.x + 0.5) * T;
        const by = (q.y + 0.5) * T;
        g.moveTo(ax, ay).quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + T * 0.35, bx, by);
      }
    }
    g.stroke(line(0.13, 1));
    for (const p of poles) {
      const cx = (p.x + 0.5) * T;
      const cy = (p.y + 0.5) * T;
      const s = T * 0.14;
      g.rect(cx - s, cy - s, s * 2, s * 2).moveTo(cx - s, cy - s).lineTo(cx + s, cy + s).moveTo(cx + s, cy - s).lineTo(cx - s, cy + s);
    }
    g.stroke(line(STROKE.soft, 1));
  }
}
