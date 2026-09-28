import { Container, Graphics, Rectangle } from 'pixi.js';
import { COLORS } from '../config';

/**
 * Base for everything that can be switched on and off by a click:
 * drills, furnaces, assembling machines and inserters.
 */
export abstract class Machine {
  abstract readonly label: string;
  readonly view = new Container();
  /** Everything that dims when the machine is off. */
  protected readonly body = new Container();
  /** Outline, tinted with the accent colour on hover. */
  protected readonly frame = new Graphics();
  /** Extra parts that should also light up on hover. */
  protected readonly highlight: Container[] = [this.frame];
  private readonly led = new Graphics();

  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  protected readonly T: number;

  on = true;
  private hovered = false;

  constructor(x: number, y: number, w: number, h: number, T: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.T = T;
    this.view.position.set(x * T, y * T);
    this.view.addChild(this.body, this.led);
    this.body.addChild(this.frame);
    this.view.eventMode = 'static';
    this.view.cursor = 'pointer';
    this.view.hitArea = new Rectangle(0, 0, w * T, h * T);
    this.view.interactiveChildren = false;
    this.led.circle(0, 0, Math.max(1.8, T * 0.065)).fill({ color: 0xffffff });
    this.placeLed(this.led);
  }

  /** Where the status diode sits; subclasses may move it. */
  protected placeLed(led: Graphics) {
    led.position.set(this.w * this.T - this.T * 0.26, this.T * 0.26);
  }

  /** Busy right now (for the diode). */
  abstract get working(): boolean;

  abstract update(dt: number): void;

  render(_time: number) {}

  toggle() {
    this.on = !this.on;
    this.refresh();
  }

  setHover(hovered: boolean) {
    this.hovered = hovered;
    this.refresh();
  }

  /** Centre in tile units (for tooltips on touch). */
  get center() {
    return { x: this.x + this.w / 2, y: this.y };
  }

  protected refresh() {
    this.body.alpha = this.on ? 1 : this.hovered ? 0.55 : 0.25;
    for (const part of this.highlight) part.tint = this.hovered ? COLORS.accent : 0xffffff;
  }

  /** Called every frame after update: keeps the diode in sync with the state. */
  renderLed(time: number) {
    if (!this.on) {
      this.led.tint = COLORS.off;
      this.led.alpha = 0.95;
    } else if (this.working) {
      this.led.tint = COLORS.accent;
      this.led.alpha = 0.85 + 0.15 * Math.sin(time * 6 + this.x);
    } else {
      this.led.tint = COLORS.accent;
      this.led.alpha = 0.3;
    }
  }
}
