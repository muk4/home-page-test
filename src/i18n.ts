export type Lang = 'pl' | 'en';

/**
 * All language-dependent texts: the {{tokens}} of the index.html template
 * (filled in per page by the i18n plugin in vite.config.ts) and the strings
 * the script shows. HTML is allowed in `intro` only.
 */
export const TEXTS = {
  pl: {
    lang: 'pl',
    title: 'Piotr Kansy Software Solutions – strony, aplikacje i automatyzacja dla firm',
    description:
      'Cześć, jestem Piotrek – senior full-stack developer (C#, .NET). Tworzę strony internetowe, aplikacje i systemy dla firm, m.in. dla produkcji i magazynów.',
    ogLocale: 'pl_PL',
    ogLocaleAlt: 'en_US',
    ogDescription:
      'Cześć, jestem Piotrek – senior full-stack developer (C#, .NET). Strony internetowe, aplikacje i systemy dla firm, m.in. dla produkcji i magazynów.',
    ogImage: 'og-image.png',
    ogImageAlt: 'Animowana fabryka w stylu schematu technicznego i powitanie',
    orgDescription: 'Strony internetowe, aplikacje i automatyzacja dla firm produkcyjnych i magazynów.',
    greeting: 'Cześć, jestem Piotrek!',
    intro:
      'Tworzę strony internetowe, aplikacje i&nbsp;systemy dla firm. Od ponad dekady pracuję nad oprogramowaniem wspierającym między innymi produkcję i&nbsp;magazyny. Pomagam też rozwijać i&nbsp;usprawniać istniejące rozwiązania. Napisz, jeśli masz ciekawy pomysł albo problem do rozwiązania!',
    contact: 'Kontakt',
    cargo: 'Skontaktuj się',
    contactDetails: 'Dane kontaktowe',
    newTab: 'otwiera się w nowej karcie',
    langNav: 'Język strony',
    clickOff: 'kliknij, żeby wyłączyć',
    clickOn: 'kliknij, żeby włączyć',
    tapOff: 'dotknij, żeby wyłączyć',
    tapOn: 'dotknij, żeby włączyć',
  },
  en: {
    lang: 'en',
    title: 'Piotr Kansy Software Solutions – websites, apps and automation for businesses',
    description:
      'Hi, I’m Peter – a senior full-stack developer (C#, .NET). I build websites, applications and software systems for businesses, including manufacturing and warehousing.',
    ogLocale: 'en_US',
    ogLocaleAlt: 'pl_PL',
    ogDescription:
      'Hi, I’m Peter – a senior full-stack developer (C#, .NET). Websites, applications and software systems for businesses, including manufacturing and warehousing.',
    ogImage: 'og-image-en.png',
    ogImageAlt: 'An animated factory drawn as a technical blueprint, with a greeting',
    orgDescription: 'Websites, applications and automation for manufacturing and warehousing businesses.',
    greeting: 'Hi, I’m Peter!',
    intro:
      'I build websites, applications, and software systems for businesses. For over a decade, I’ve been working on software for areas such as manufacturing and warehousing. I also help develop and improve existing solutions. Got an interesting idea or a problem to solve? Get in touch!',
    contact: 'Contact',
    cargo: 'Get in touch',
    contactDetails: 'Contact details',
    newTab: 'opens in a new tab',
    langNav: 'Page language',
    clickOff: 'click to turn off',
    clickOn: 'click to turn on',
    tapOff: 'tap to turn off',
    tapOn: 'tap to turn on',
  },
} as const satisfies Record<Lang, Record<string, string>>;

/** Language of the page being shown (set on <html lang> by the build). */
export function pageLang(): Lang {
  return document.documentElement.lang === 'pl' ? 'pl' : 'en';
}
