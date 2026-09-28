import { Container, Graphics } from 'pixi.js';
import { COLORS, STROKE, TRAIN } from '../config';
import type { Cargo } from '../ui/Cargo';
import { accentLine, blackFill, line } from './draw';
import type { LayoutData } from './types';

/** Survives factory rebuilds (resize), so the delivery happens once. */
export interface Story {
  phase: 'waiting' | 'delivering' | 'delivered';
  /** Seconds left until the contact train sets off. */
  timer: number;
}

type Phase = 'arrive' | 'craneOut' | 'lift' | 'carry' | 'lower' | 'release' | 'depart' | 'pass';

interface Car {
  kind: 'loco' | 'flat';
  length: number;
  view: Container;
  /** Offset of the car's front from the train's front (tiles). */
  offset: number;
  /** Carries the contact container (HTML) or a plain one (drawn here). */
  load: 'contact' | 'plain' | null;
  loadView?: Graphics;
}

const LOCO = 5;
const FLAT = 7.8;
const GAP = 0.35;
const BODY = 1.5;

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The train: after a few seconds it brings the contact container, stops at
 * the station, the gantry crane puts the container on the platform, and the
 * train leaves. Later, freight trains just pass by now and then.
 */
export class Train {
  private readonly layout: LayoutData;
  private readonly cargo: Cargo;
  private readonly story: Story;
  private readonly layer: Container;
  private readonly beam = new Container();
  private readonly T: number;

  private cars: Car[] = [];
  private train: Container | null = null;
  private phase: Phase | null = null;
  private dir = 1;
  /** Position of the train's front along the track (tiles). */
  private head = 0;
  private speed = 0;
  private t = 0;
  private beamY: number;
  private passTimer: number;

  constructor(layout: LayoutData, layer: Container, cargo: Cargo, story: Story) {
    this.layout = layout;
    this.layer = layer;
    this.cargo = cargo;
    this.story = story;
    this.T = layout.tile;
    this.beamY = layout.station.platformY;
    this.passTimer = rand(TRAIN.passDelayMin, TRAIN.passDelayMax) * 0.6;
    this.drawBeam();
    layer.addChild(this.beam);
    this.placeBeam();

    if (story.phase === 'delivering') story.phase = 'delivered';
    if (story.phase === 'delivered') cargo.land();
    else this.parkCargoOffscreen();
  }

  /** Deliver right away (keyboard user reached the container, reduced motion, ...). */
  skip() {
    if (this.story.phase === 'delivered') return;
    this.story.phase = 'delivered';
    this.cargo.land();
    const contact = this.cars.find((c) => c.load === 'contact');
    if (contact) contact.load = null;
    if (this.phase && this.phase !== 'pass') {
      this.phase = 'depart';
      this.beamY = this.layout.station.platformY;
      this.placeBeam();
    }
  }

  /** Reduced motion: the container is simply there and no trains run. */
  halt() {
    this.skip();
    if (this.phase) this.despawn();
  }

  update(dt: number) {
    const { station } = this.layout;
    if (!this.phase) {
      if (this.story.phase === 'waiting') {
        this.story.timer -= dt;
        if (this.story.timer <= 0) this.spawnContactTrain();
      } else {
        this.passTimer -= dt;
        if (this.passTimer <= 0) this.spawnFreightTrain();
      }
      return;
    }

    const stopHead = this.stopHead();
    switch (this.phase) {
      case 'arrive': {
        const dist = stopHead - this.head;
        const v = Math.min(TRAIN.speed, Math.sqrt(2 * TRAIN.decel * Math.max(0, dist)));
        this.speed = Math.max(v, 0.25);
        this.head = Math.min(stopHead, this.head + this.speed * dt);
        if (stopHead - this.head < 0.005) {
          this.head = stopHead;
          this.speed = 0;
          this.next('craneOut');
        }
        break;
      }
      case 'craneOut':
        this.t += dt / 1.1;
        this.beamY = station.platformY + (station.trackY - station.platformY) * ease(Math.min(1, this.t));
        if (this.t >= 1) this.next('lift');
        break;
      case 'lift':
        this.t += dt / 0.5;
        if (this.t >= 1) this.next('carry');
        break;
      case 'carry':
        this.t += dt / 1.4;
        this.beamY = station.trackY + (station.platformY - station.trackY) * ease(Math.min(1, this.t));
        if (this.t >= 1) this.next('lower');
        break;
      case 'lower':
        this.t += dt / 0.5;
        if (this.t >= 1) this.next('release');
        break;
      case 'release':
        this.t += dt / 0.45;
        if (this.t >= 1) {
          this.story.phase = 'delivered';
          this.cargo.land();
          this.next('depart');
        }
        break;
      case 'depart':
      case 'pass':
        this.speed = Math.min(TRAIN.speed, this.speed + TRAIN.accel * dt);
        this.head += this.speed * dt;
        if (this.head - this.length() > this.layout.bounds.x + this.layout.bounds.w + 1) this.despawn();
        break;
    }
    if (this.phase) this.render();
  }

  private next(phase: Phase) {
    this.phase = phase;
    this.t = 0;
    if (phase === 'carry') {
      const contact = this.cars.find((c) => c.load === 'contact');
      if (contact) contact.load = null;
    }
  }

  private render() {
    const T = this.T;
    const { station, view } = this.layout;
    if (!this.train) return;
    // Direction: +1 drives right; the train's x axis is flipped for -1.
    this.train.position.set(this.headX() * T, station.trackY * T);

    const contact = this.cars.find((c) => c.load === 'contact');
    if (contact && this.story.phase !== 'delivered') {
      const cx = this.carCenter(contact);
      this.cargo.transit((cx - station.centerX) * T, (station.trackY - station.platformY) * T, 0);
    } else if (this.story.phase === 'delivering') {
      let lift = 0;
      if (this.phase === 'lift') lift = ease(this.t);
      else if (this.phase === 'carry') lift = 1;
      else if (this.phase === 'lower') lift = 1 - ease(this.t);
      this.cargo.transit(0, (this.beamY - station.platformY) * T, lift);
    }
    this.placeBeam();
    // Keep off-screen trains cheap.
    this.train.visible = this.head > view.x - 1 && this.head - this.length() < view.x + view.w + 1;
  }

  private placeBeam() {
    const T = this.T;
    const { station } = this.layout;
    this.beam.position.set(station.centerX * T, this.beamY * T);
    const busy = this.phase === 'lift' || this.phase === 'carry' || this.phase === 'lower';
    this.beam.children[1].tint = busy ? COLORS.accent : 0xffffff;
  }

  private stopHead() {
    const contact = this.cars.find((c) => c.load === 'contact');
    const offset = contact ? contact.offset + contact.length / 2 : 0;
    return this.layout.station.centerX + offset;
  }

  private length() {
    const last = this.cars[this.cars.length - 1];
    return last ? last.offset + last.length : 0;
  }

  /** Screen x (tiles) of the train's front. */
  private headX() {
    const { bounds } = this.layout;
    return this.dir > 0 ? this.head : bounds.x + bounds.w - (this.head - bounds.x);
  }

  private carCenter(car: Car) {
    const x = this.head - car.offset - car.length / 2;
    const { bounds } = this.layout;
    return this.dir > 0 ? x : bounds.x + bounds.w - (x - bounds.x);
  }

  private spawnContactTrain() {
    this.story.phase = 'delivering';
    this.build(['loco', 'contact', 'plain'], 1);
    this.head = this.layout.view.x - 0.5;
    this.speed = TRAIN.speed;
    this.next('arrive');
    this.render();
  }

  private spawnFreightTrain() {
    const wagons = 1 + Math.floor(Math.random() * 3);
    const loads: ('plain' | null)[] = Array.from({ length: wagons }, () => (Math.random() < 0.8 ? 'plain' : null));
    this.build(['loco', ...loads], Math.random() < 0.5 ? 1 : -1);
    this.head = this.layout.bounds.x - 0.5;
    this.speed = TRAIN.speed * 0.85;
    this.next('pass');
    this.render();
  }

  private despawn() {
    this.train?.destroy({ children: true });
    this.train = null;
    this.cars = [];
    this.phase = null;
    this.passTimer = rand(TRAIN.passDelayMin, TRAIN.passDelayMax);
  }

  private parkCargoOffscreen() {
    const { station, view } = this.layout;
    this.cargo.transit((view.x - 12 - station.centerX) * this.T, (station.trackY - station.platformY) * this.T, 0);
  }

  // ---------- drawing ----------

  private build(spec: ('loco' | 'contact' | 'plain' | null)[], dir: number) {
    this.train?.destroy({ children: true });
    const train = new Container();
    train.scale.x = dir;
    this.dir = dir;
    this.cars = [];
    let offset = 0;
    for (const s of spec) {
      const kind = s === 'loco' ? 'loco' : 'flat';
      const length = kind === 'loco' ? LOCO : FLAT;
      const car: Car = { kind, length, offset, view: new Container(), load: s === 'loco' ? null : s };
      car.view.position.x = (-offset - length / 2) * this.T;
      if (kind === 'loco') this.drawLoco(car.view);
      else this.drawFlat(car.view, s === 'plain');
      train.addChild(car.view);
      this.cars.push(car);
      offset += length + GAP;
    }
    this.layer.addChildAt(train, 0);
    this.train = train;
  }

  private drawLoco(c: Container) {
    const T = this.T;
    const L = LOCO * T;
    const W = BODY * T;
    const g = new Graphics();
    const x0 = -L / 2;
    const x1 = L / 2;
    const nose = T * 0.7;
    g.poly([x0, -W / 2, x1 - nose, -W / 2, x1, -W / 2 + T * 0.3, x1, W / 2 - T * 0.3, x1 - nose, W / 2, x0, W / 2])
      .fill(blackFill)
      .stroke(line(STROKE.strong));
    // cab with windows
    g.rect(x1 - nose - T * 1.1, -W / 2 + T * 0.12, T * 1.1, W - T * 0.24).stroke(line(STROKE.normal));
    g.rect(x1 - nose - T * 0.5, -W / 2 + T * 0.25, T * 0.35, W - T * 0.5).stroke(line(STROKE.soft, 1));
    // engine hood: grille and hatches
    for (let i = 0; i < 7; i++) {
      const x = x0 + T * 0.45 + i * T * 0.22;
      g.moveTo(x, -W / 2 + T * 0.3).lineTo(x, W / 2 - T * 0.3);
    }
    g.stroke(line(0.4, 1));
    g.rect(x0 + T * 2.15, -W / 2 + T * 0.3, T * 1.2, W - T * 0.6).stroke(line(STROKE.soft, 1));
    g.circle(x0 + T * 2.75, 0, T * 0.22).stroke(line(STROKE.soft, 1));
    // couplers
    g.moveTo(x0, 0).lineTo(x0 - T * 0.2, 0).stroke(line(STROKE.normal));
    // headlights
    g.circle(x1 - T * 0.12, -W / 2 + T * 0.45, T * 0.06).circle(x1 - T * 0.12, W / 2 - T * 0.45, T * 0.06).fill({ color: COLORS.accent });
    c.addChild(g);
  }

  private drawFlat(c: Container, plain: boolean) {
    const T = this.T;
    const L = FLAT * T;
    const W = BODY * T;
    const g = new Graphics();
    g.rect(-L / 2, -W / 2 + T * 0.12, L, W - T * 0.24).fill(blackFill).stroke(line(STROKE.normal));
    for (let x = -L / 2 + T * 0.6; x < L / 2 - T * 0.3; x += T * 0.65) g.moveTo(x, -W / 2 + T * 0.12).lineTo(x, W / 2 - T * 0.12);
    g.stroke(line(0.25, 1));
    g.moveTo(-L / 2, 0).lineTo(-L / 2 - T * 0.18, 0).moveTo(L / 2, 0).lineTo(L / 2 + T * 0.18, 0).stroke(line(STROKE.normal));
    c.addChild(g);
    if (plain) c.addChild(this.drawContainer());
  }

  /** A plain container (the contact one is HTML). */
  private drawContainer() {
    const T = this.T;
    const L = TRAIN.cargoLength * T;
    const W = TRAIN.cargoWidth * T * 0.92;
    const g = new Graphics();
    g.rect(-L / 2, -W / 2, L, W).fill(blackFill).stroke(line(STROKE.strong));
    for (let x = -L / 2 + T * 0.22; x < L / 2; x += T * 0.22) g.moveTo(x, -W / 2 + 2).lineTo(x, W / 2 - 2);
    g.stroke(line(0.16, 1));
    g.moveTo(-L / 2 + T * 0.3, -W / 2).lineTo(-L / 2 + T * 0.3, W / 2).moveTo(L / 2 - T * 0.3, -W / 2).lineTo(L / 2 - T * 0.3, W / 2);
    g.stroke(line(STROKE.soft, 1));
    return g;
  }

  private drawBeam() {
    const T = this.T;
    const { station } = this.layout;
    const half = ((station.craneX1 - station.craneX0) / 2) * T;
    const rails = new Graphics();
    rails
      .rect(-half - T * 0.25, -T * 0.22, half * 2 + T * 0.5, T * 0.44)
      .stroke(line(STROKE.normal, 1))
      .moveTo(-half, -T * 0.12)
      .lineTo(half, -T * 0.12)
      .moveTo(-half, T * 0.12)
      .lineTo(half, T * 0.12)
      .stroke(line(STROKE.strong));
    const trolley = new Graphics();
    trolley
      .rect(-T * 0.55, -T * 0.34, T * 1.1, T * 0.68)
      .fill(blackFill)
      .stroke(line(STROKE.strong))
      .moveTo(-T * 0.3, 0)
      .lineTo(T * 0.3, 0)
      .stroke(accentLine(0.9, 1));
    this.beam.addChild(rails, trolley);
  }
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}
