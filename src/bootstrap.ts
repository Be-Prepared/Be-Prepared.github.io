import { di } from './di';
import { I18nService } from './i18n/i18n.service';
import { InstallPwaService } from './install-pwa/install-pwa.service';
import { ReminderService } from './services/reminder.service';
import { UpdatePwaService } from './update-pwa/update-pwa.service';

// Resolves once the translation is loaded, so the first screen is already
// in the right language.
export const bootstrap = async () => {
    await di(I18nService).init(
        navigator.languages?.length
            ? navigator.languages
            : [navigator.language || '']
    );
    di(InstallPwaService).listenForEvents();
    di(UpdatePwaService).listenForEvents();

    // The timer and alarm clock ring from any screen.
    document.body.append(document.createElement('reminder-ringer'));
    di(ReminderService).init();
};
