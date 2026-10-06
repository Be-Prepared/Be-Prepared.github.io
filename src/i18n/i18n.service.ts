import { chooseLanguage } from './choose-language';
import { enUS } from './en-us';
import { LanguageData } from './language-data';
import { languages } from './languages';

export class I18nService {
    private _data: LanguageData = enUS;

    get(str: string) {
        return this._data[str] || str;
    }

    // Uses the first language in the browser's preference list that has a
    // translation, so someone who reads Portuguese and then English gets
    // Portuguese when it exists.
    set(preferences: string | readonly string[]) {
        const list = typeof preferences === 'string' ? [preferences] : preferences;
        const language = chooseLanguage(list, Object.keys(languages));
        this._data = languages[language] || enUS;
        const html = document.getElementsByTagName('html')[0];

        if (html) {
            // The language actually shown, for screen readers and spelling.
            html.setAttribute('lang', language || 'en-US');
        }

        const title = document.getElementsByTagName('title')[0];

        if (title) {
            title.textContent = this.get('app.title');
        }
    }

    update(obj: { [key: string]: string }) {
        for (const key of Object.keys(obj)) {
            obj[key] = this.get(key);
        }
    }
}
