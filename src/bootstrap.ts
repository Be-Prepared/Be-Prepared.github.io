import { di } from './di';
import { I18nService } from './i18n/i18n.service';
import { InstallPwaService } from './install-pwa/install-pwa.service';
import { ReminderService } from './services/reminder.service';
import { UpdatePwaService } from './update-pwa/update-pwa.service';

export const bootstrap = () => {
    di(I18nService).set(navigator.language || '');
    di(InstallPwaService).listenForEvents();
    di(UpdatePwaService).listenForEvents();

    // The timer and alarm clock ring from any screen.
    document.body.append(document.createElement('reminder-ringer'));
    di(ReminderService).init();
};
