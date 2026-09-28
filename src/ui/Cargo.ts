/** Longest door animation (CSS) plus a margin; fallback when transitionend never comes. */
const DOOR_CLOSE_MS = 800;

/**
 * The "Skontaktuj się" container. A real <button> with aria-expanded; the
 * links live in the HTML from the start, the doors only cover them.
 * Open doors (or the empty inside) close it again, as does Esc.
 * While the train carries it, the element is moved with a transform.
 */
export class Cargo {
  readonly el: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly links: HTMLElement;
  private readonly door: HTMLElement;
  private landed = true;
  private closeTimer = 0;
  /** Asked to skip the delivery (keyboard focus or activation during transit). */
  onSkip: (() => void) | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    this.toggleBtn = el.querySelector('.cargo__toggle')!;
    this.links = el.querySelector('.cargo__inside')!;
    this.door = el.querySelector('.cargo__door')!;

    // Also fires for clicks on the open doors: they sit inside the button.
    this.toggleBtn.addEventListener('click', () => {
      if (!this.landed) this.onSkip?.();
      this.setOpen(!this.isOpen);
    });
    // Clicking the empty inside (not a link) shuts the doors too.
    this.links.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('a')) this.setOpen(false);
    });
    el.addEventListener('focusin', (e) => {
      if (!this.landed) this.onSkip?.();
      if (this.links.contains(e.target as Node) && !this.isOpen) this.setOpen(true);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.setOpen(false);
        this.toggleBtn.focus();
      }
    });
    this.door.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'transform' && !this.isOpen) this.closed();
    });
  }

  get isOpen() {
    return this.el.dataset.open === 'true';
  }

  setOpen(open: boolean) {
    if (open === this.isOpen) return;
    this.el.dataset.open = String(open);
    this.toggleBtn.setAttribute('aria-expanded', String(open));
    window.clearTimeout(this.closeTimer);
    if (open) {
      this.el.classList.remove('is-closing');
    } else {
      // Keep the label hidden until the doors are shut.
      this.el.classList.add('is-closing');
      this.closeTimer = window.setTimeout(() => this.closed(), DOOR_CLOSE_MS);
    }
  }

  private closed() {
    window.clearTimeout(this.closeTimer);
    this.el.classList.remove('is-closing');
  }

  /** Put the container somewhere else than its spot on the platform (px offsets). */
  transit(dx: number, dy: number, lift = 0) {
    if (this.landed) {
      this.landed = false;
      this.el.classList.add('is-transit');
      this.setOpen(false);
      this.closed();
    }
    this.el.classList.toggle('is-lifted', lift > 0.01);
    const scale = 1 + lift * 0.06;
    this.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  }

  land() {
    this.landed = true;
    this.el.classList.remove('is-transit', 'is-lifted');
    this.el.style.transform = '';
  }

  get isLanded() {
    return this.landed;
  }
}
