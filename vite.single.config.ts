import { defineConfig, mergeConfig, type Plugin } from 'vite';
import base from './vite.config.ts';

/**
 * Single-file build: everything (JS, CSS) inlined into dist-single/index.html,
 * so the page can be dropped on any static host or opened from disk.
 * `npm run build:single`
 */
function inlineAssets(): Plugin {
  return {
    name: 'inline-assets',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);
      for (const file of Object.values(bundle)) {
        const ref = `./${file.fileName}`;
        if (file.type === 'chunk' && source.includes(ref)) {
          // Dynamic imports are inlined, so Vite leaves its preload-list marker unfilled.
          const code = file.code.replace(/__VITE_PRELOAD__/g, 'void 0').replace(/<\/script/gi, '<\\/script');
          source = source.replace(new RegExp(`<script[^>]*src="${ref}"[^>]*></script>`), () => `<script type="module">${code}</script>`);
          delete bundle[file.fileName];
        } else if (file.type === 'asset' && file.fileName.endsWith('.css') && source.includes(ref)) {
          source = source.replace(new RegExp(`<link[^>]*href="${ref}"[^>]*>`), () => `<style>${String(file.source)}</style>`);
          delete bundle[file.fileName];
        }
      }
      html.source = source.replace(/<link rel="modulepreload"[^>]*>\s*/g, '');
    },
  };
}

export default mergeConfig(
  base,
  defineConfig({
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
