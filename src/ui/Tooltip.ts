/** Small Factorio-like tooltip next to the pointer: just what a click will do. */
export class Tooltip {
  private readonly el: HTMLElement;
  private hideTimer = 0;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  show(on: boolean, x: number, y: number, touch = false) {
    window.clearTimeout(this.hideTimer);
    this.el.textContent = `${touch ? 'dotknij' : 'kliknij'}, żeby ${on ? 'wyłączyć' : 'włączyć'}`;
    this.el.classList.add('is-visible');
    this.move(x, y);
  }

  /** Show for a moment (touch has no hover). */
  flash(on: boolean, x: number, y: number) {
    this.show(on, x, y, true);
    this.hideTimer = window.setTimeout(() => this.hide(), 1600);
  }

  move(x: number, y: number) {
    const r = this.el.getBoundingClientRect();
    const px = Math.min(Math.max(8, x + 14), window.innerWidth - r.width - 8);
    const below = y + 20 + r.height < window.innerHeight - 8;
    const py = below ? y + 20 : y - r.height - 14;
    this.el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
  }

  hide() {
    window.clearTimeout(this.hideTimer);
    this.el.classList.remove('is-visible');
  }
}
