import { chooseLanguage } from './choose-language';
import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { enUS } from './en-us';
import { LanguageData } from './language-data';
import { LocalStorageService } from '../services/local-storage.service';

// The language picked on the Info screen. Empty means follow the browser.
export const languagePreference = LocalStorageService.string('language');

export class I18nService {
    private _data: LanguageData = enUS;
    dir: 'ltr' | 'rtl' = 'ltr';
    language = DEFAULT_LANGUAGE;

    get(str: string) {
        // Language names are always written in their own language.
        const name = str.startsWith('language.') && LANGUAGES[str.slice(9)]?.name;

        return name || this._data[str] || enUS[str] || str;
    }

    // Uses the language picked on the Info screen, or else the first
    // language in the browser's preference list that has a translation, so
    // someone who reads Portuguese and then English gets Portuguese.
    async init(preferences: readonly string[]) {
        const picked = languagePreference.getItem();
        let language =
            picked && LANGUAGES[picked]
                ? picked
                : chooseLanguage(preferences, Object.keys(LANGUAGES)) || DEFAULT_LANGUAGE;

        try {
            this._data = await LANGUAGES[language].load();
        } catch (_ignore) {
            // Only possible if the translation's file can't load.
            language = DEFAULT_LANGUAGE;
            this._data = enUS;
        }

        this.language = language;
        this.dir = LANGUAGES[language].dir;
        const html = document.documentElement;
        // The language actually shown, for screen readers, spelling, and
        // right-to-left layout.
        html.setAttribute('lang', language);
        html.setAttribute('dir', this.dir);
        document.title = this.get('app.title');
    }

    // For dates and numbers: the shown language, but in the browser's
    // region when it's the same language (British English keeps its dates).
    locale() {
        const browser = typeof navigator === 'undefined' ? '' : navigator.language || '';
        const base = (tag: string) => tag.toLowerCase().split('-')[0];

        return browser && base(browser) === base(this.language) ? browser : this.language;
    }

    // Fills "{{name}}" placeholders.
    format(id: string, values: { [name: string]: string | number }) {
        return this.get(id).replace(/\{\{(\w+)\}\}/g, (match, name) =>
            name in values ? `${values[name]}` : match
        );
    }

    update(obj: { [key: string]: string }) {
        for (const key of Object.keys(obj)) {
            obj[key] = this.get(key);
        }
    }
}
