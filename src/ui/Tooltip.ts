/** Small Factorio-like tooltip that follows the pointer. */
export class Tooltip {
  private readonly el: HTMLElement;
  private hideTimer = 0;

  constructor(el: HTMLElement) {
    this.el = el;
  }

  show(label: string, on: boolean, x: number, y: number, touch = false) {
    window.clearTimeout(this.hideTimer);
    this.el.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'tooltip__name';
    name.textContent = label;
    const state = document.createElement('span');
    state.className = on ? 'tooltip__state' : 'tooltip__state is-off';
    state.textContent = on ? 'WŁ' : 'WYŁ';
    const help = document.createElement('span');
    help.className = 'tooltip__help';
    help.textContent = `${touch ? 'dotknij' : 'kliknij'}, żeby ${on ? 'wyłączyć' : 'włączyć'}`;
    this.el.append(name, ' – ', state, help);
    this.el.classList.add('is-visible');
    this.move(x, y);
  }

  /** Show for a moment (touch has no hover). */
  flash(label: string, on: boolean, x: number, y: number) {
    this.show(label, on, x, y, true);
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
