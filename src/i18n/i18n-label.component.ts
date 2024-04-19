import { Component, di } from 'fudgel';
import { I18nService } from './i18n.service';

@Component('i18n-label', {
    attr: ['id', 'ws'],
    // Spaces are necessary because vite/esbuild removes them
    template: '{{ws}}{{value}}{{ws}}'
})
export class I18nLabel {
    #i18nService = di(I18nService);
    id: string = '';
    ws = ' ';
    value: string = '';

    onChange() {
        this.value = this.#i18nService.get(this.id);
    }
}
