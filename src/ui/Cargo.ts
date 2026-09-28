/**
 * The "Skontaktuj się" container. A real <button> with aria-expanded; the
 * links live in the HTML from the start, the doors only cover them.
 * While the train carries it, the element is moved with a transform.
 */
export class Cargo {
  readonly el: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly links: HTMLElement;
  private landed = true;
  /** Asked to skip the delivery (keyboard focus or activation during transit). */
  onSkip: (() => void) | null = null;

  constructor(el: HTMLElement) {
    this.el = el;
    this.toggleBtn = el.querySelector('.cargo__toggle')!;
    this.closeBtn = el.querySelector('.cargo__close')!;
    this.links = el.querySelector('.cargo__inside')!;

    this.toggleBtn.addEventListener('click', () => {
      if (!this.landed) this.onSkip?.();
      this.setOpen(!this.isOpen);
    });
    this.closeBtn.addEventListener('click', () => {
      this.setOpen(false);
      this.toggleBtn.focus();
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
  }

  get isOpen() {
    return this.el.dataset.open === 'true';
  }

  setOpen(open: boolean) {
    this.el.dataset.open = String(open);
    this.toggleBtn.setAttribute('aria-expanded', String(open));
  }

  /** Put the container somewhere else than its spot on the platform (px offsets). */
  transit(dx: number, dy: number, lift = 0) {
    if (this.landed) {
      this.landed = false;
      this.el.classList.add('is-transit');
      this.setOpen(false);
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
