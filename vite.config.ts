import { defineConfig, loadEnv, type Plugin } from 'vite';
import { TEXTS, type Lang } from './src/i18n.ts';

/**
 * One template (index.html with {{tokens}}), two pages: / in Polish and
 * /en/ in English. In dev the page language follows the URL; in the build
 * both files are written from the same processed template.
 */
function i18nPages(): Plugin {
  let isBuild = false;

  const fill = (html: string, lang: Lang) => {
    const vars: Record<string, string> = {
      ...TEXTS[lang],
      pagePath: lang === 'en' ? 'en/' : '',
      plHref: lang === 'pl' ? './?lang=pl' : '../?lang=pl',
      enHref: lang === 'en' ? './?lang=en' : 'en/?lang=en',
      plCurrent: lang === 'pl' ? 'aria-current="page"' : '',
      enCurrent: lang === 'en' ? 'aria-current="page"' : '',
    };
    return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      if (!(key in vars)) throw new Error(`i18n: no text for {{${key}}}`);
      return vars[key];
    });
  };

  // The English page lives one directory deeper. Applied to the template (before
  // the tokens are filled), so the switcher's own links are left as written.
  const relocate = (html: string) => html.replace(/(\s(?:src|href)=")\.\//g, '$1../');

  return {
    name: 'i18n-pages',
    // After Vite's own HTML plugin, which emits index.html in its generateBundle.
    enforce: 'post',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (isBuild) return html;
        return fill(html, /^\/en(\/|$|\?)/.test(ctx.originalUrl ?? '') ? 'en' : 'pl');
      },
    },
    generateBundle(_options, bundle) {
      const page = bundle['index.html'];
      if (!page || page.type !== 'asset') return;
      const template = String(page.source);
      page.source = fill(template, 'pl');
      this.emitFile({ type: 'asset', fileName: 'en/index.html', source: fill(relocate(template), 'en') });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Fail early if the site address is missing (canonical/OG links need it).
  if (!loadEnv(mode, process.cwd()).VITE_SITE_URL && !process.env.VITE_SITE_URL) {
    throw new Error('VITE_SITE_URL is not set (see .env)');
  }
  return {
    // Relative asset paths, so the build works from any sub-path (e.g. GitHub Pages).
    base: './',
    plugins: [i18nPages()],
    build: {
      target: 'es2022',
      // PixiJS is big on its own; that's expected for this page.
      chunkSizeWarningLimit: 900,
    },
  };
});
