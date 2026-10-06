import { enUS } from './en-us';
import { LanguageData } from './language-data';

export interface LanguageInfo {
    dir: 'ltr' | 'rtl';
    // Translations load on demand, so each person only downloads one. The
    // service worker still caches all of them for offline use.
    load: () => Promise<LanguageData>;
    // The language's name in itself, so people can find their own.
    name: string;
}

export const DEFAULT_LANGUAGE = 'en-US';

// Missing keys in a translation fall back to English.
export const LANGUAGES: { [tag: string]: LanguageInfo } = {
    ar: { dir: 'rtl', load: () => import('./translations/ar').then((m) => m.strings), name: 'العربية' },
    de: { dir: 'ltr', load: () => import('./translations/de').then((m) => m.strings), name: 'Deutsch' },
    'en-US': { dir: 'ltr', load: () => Promise.resolve(enUS), name: 'English' },
    es: { dir: 'ltr', load: () => import('./translations/es').then((m) => m.strings), name: 'Español' },
    fr: { dir: 'ltr', load: () => import('./translations/fr').then((m) => m.strings), name: 'Français' },
    id: { dir: 'ltr', load: () => import('./translations/id').then((m) => m.strings), name: 'Bahasa Indonesia' },
    ja: { dir: 'ltr', load: () => import('./translations/ja').then((m) => m.strings), name: '日本語' },
    pt: { dir: 'ltr', load: () => import('./translations/pt').then((m) => m.strings), name: 'Português' },
    ru: { dir: 'ltr', load: () => import('./translations/ru').then((m) => m.strings), name: 'Русский' },
    zh: { dir: 'ltr', load: () => import('./translations/zh').then((m) => m.strings), name: '简体中文' },
};
