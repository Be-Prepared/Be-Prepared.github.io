import { Controller, component, metadata } from 'fudgel';
import { di } from '../di';
import { I18nService } from './i18n.service';

export class I18nHtmlComponent {
    private _i18nService = di(I18nService);
    id: string = '';

    onViewInit() {
        const root = (this as Controller)[metadata]?.root;

        if (root) {
            root.innerHTML = this._i18nService.get(this.id);
        }
    }
}

component('i18n-html', {
    attr: ['id'],
    template: '',
}, I18nHtmlComponent);
