import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config.ts';

/**
 * Single-file build: JS and CSS inlined into every page (dist-single/index.html
 * and dist-single/en/index.html), so the site can be dropped on any static
 * host or opened from disk. `npm run build:single`
 */
function inlineAssets(): Plugin {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    name: 'inline-assets',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const pages = Object.values(bundle).filter((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      const inlined = new Set<string>();
      for (const page of pages) {
        if (page.type !== 'asset') continue;
        let source = String(page.source);
        for (const file of Object.values(bundle)) {
          // Pages reference assets as ./assets/… or, one level down, ../assets/…
          const ref = `(?:\\.\\.?/)${escape(file.fileName)}`;
          if (file.type === 'chunk') {
            const tag = new RegExp(`<script[^>]*src="${ref}"[^>]*></script>`);
            if (!tag.test(source)) continue;
            // Dynamic imports are inlined, so Vite leaves its preload-list marker unfilled.
            const code = file.code.replace(/__VITE_PRELOAD__/g, 'void 0').replace(/<\/script/gi, '<\\/script');
            source = source.replace(tag, () => `<script type="module">${code}</script>`);
            inlined.add(file.fileName);
          } else if (file.fileName.endsWith('.css')) {
            const tag = new RegExp(`<link[^>]*href="${ref}"[^>]*>`);
            if (!tag.test(source)) continue;
            source = source.replace(tag, () => `<style>${String(file.source)}</style>`);
            inlined.add(file.fileName);
          }
        }
        page.source = source.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
      }
      for (const name of inlined) delete bundle[name];
    },
  };
}

export default defineConfig((env) =>
  mergeConfig(typeof base === 'function' ? base(env) : base, {
    plugins: [inlineAssets()],
    build: {
      outDir: 'dist-single',
      cssCodeSplit: false,
      modulePreload: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      rolldownOptions: { output: { codeSplitting: false } },
    },
  }),
);
