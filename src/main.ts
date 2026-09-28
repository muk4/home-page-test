import './style.css';
import { Application } from 'pixi.js';
import { COLORS, SIM, TRAIN } from './config';
import { Factory, type FactoryHooks } from './factory/Factory';
import { computeLayout } from './factory/layout';
import { Train, type Story } from './factory/Train';
import { Cargo } from './ui/Cargo';
import { Crane } from './ui/Crane';
import { Tooltip } from './ui/Tooltip';

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
/** With reduced motion the factory barely moves (and the train stays home). */
const REDUCED_TIME_SCALE = 0.15;

async function boot() {
  const host = document.getElementById('factory')!;
  const intro = document.querySelector<HTMLElement>('.intro')!;
  const station = document.getElementById('station')!;
  const tooltip = new Tooltip(document.getElementById('tooltip')!);
  const cargo = new Cargo(document.getElementById('cargo')!);
  const crane = new Crane(document.getElementById('crane')!);

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: COLORS.bg,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
  });
  host.appendChild(app.canvas);
  app.stage.eventMode = 'passive';

  // Fonts change the height of the text, and the layout depends on it.
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);

  let reducedMotion = reducedMotionQuery.matches;
  let factory: Factory | null = null;
  let train: Train | null = null;
  const story: Story = {
    phase: reducedMotion ? 'delivered' : 'waiting',
    timer: TRAIN.firstDelayMin + Math.random() * (TRAIN.firstDelayMax - TRAIN.firstDelayMin),
  };
  cargo.onSkip = () => train?.skip();

  const hooks: FactoryHooks = {
    hover(machine, x, y) {
      if (machine) tooltip.show(machine.label, machine.on, x, y);
      else tooltip.hide();
    },
    move(x, y) {
      tooltip.move(x, y);
    },
    toggled(machine, touch) {
      const p = factory!.toScreen(machine.center.x, machine.center.y);
      if (touch) tooltip.flash(machine.label, machine.on, p.x, p.y);
      else tooltip.show(machine.label, machine.on, p.x, p.y);
    },
  };

  let lastKey = '';
  const build = () => {
    const tile = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tile')) || 32;
    const introRect = intro.getBoundingClientRect();
    const stationRect = station.getBoundingClientRect();
    const key = [innerWidth, innerHeight, tile, introRect.top, introRect.height, introRect.width, stationRect.top]
      .map((v) => Math.round(v))
      .join('|');
    if (key === lastKey) return;
    lastKey = key;

    const layout = computeLayout({ width: innerWidth, height: innerHeight, tile, intro: introRect, station: stationRect });
    factory?.destroy();
    factory = new Factory(layout, hooks);
    app.stage.addChild(factory.root);
    factory.prewarm(SIM.prewarm);
    train = new Train(layout, factory.trainLayer, cargo, crane, story);
    tooltip.hide();
  };
  build();
  document.documentElement.classList.add('is-ready');

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    factory?.update(dt * (reducedMotion ? REDUCED_TIME_SCALE : 1));
    if (!reducedMotion) train?.update(dt);
  });

  let resizeTimer = 0;
  const scheduleBuild = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 150);
  };
  window.addEventListener('resize', scheduleBuild);
  new ResizeObserver(scheduleBuild).observe(intro);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  });

  reducedMotionQuery.addEventListener('change', () => {
    reducedMotion = reducedMotionQuery.matches;
    if (reducedMotion) train?.halt();
  });

  // Debug handle for manual testing in the console.
  if (import.meta.env.DEV) Object.assign(window, { __app: app, __factory: () => factory, __train: () => train, __story: story, __cargo: cargo });
}

boot().catch((err) => {
  // No WebGL or similar: the page still works, just without the factory.
  console.warn('Factory disabled:', err);
  document.documentElement.classList.add('is-ready');
});
