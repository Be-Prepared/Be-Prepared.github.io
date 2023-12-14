import { di } from './di';
import { I18nService } from './i18n/i18n.service';

export const bootstrap = () => {
    const i18nService = di(I18nService);
    i18nService.set(navigator.language || '');
}
