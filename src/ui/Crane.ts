/**
 * Gantry crane beam over the platform. It is HTML (like the container) so it
 * can pass over the container instead of under it.
 */
export class Crane {
  private readonly el: HTMLElement;
  private readonly spreader: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    this.spreader = el.querySelector('.crane__spreader')!;
  }

  /**
   * @param y     beam centre, px below the top of the platform
   * @param grip  0 = spreader up and hidden, 1 = locked on the container
   * @param lift  0..1, the container being raised (it grows a little)
   */
  set(y: number, grip: number, lift: number) {
    this.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    this.spreader.style.opacity = grip.toFixed(3);
    this.spreader.style.transform = `scale(${(1 + lift * 0.06).toFixed(3)})`;
    this.el.classList.toggle('is-gripping', grip > 0.5);
  }
}
