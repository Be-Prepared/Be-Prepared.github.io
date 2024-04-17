import { di } from 'fudgel';
import { I18nService } from './i18n/i18n.service';
import { InstallPwaService } from './install-pwa/install-pwa.service';

export const bootstrap = () => {
    di(I18nService).set(navigator.language || '');
    di(InstallPwaService).listenForEvents();
};
