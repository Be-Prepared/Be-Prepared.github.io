import { BrowserDetection, detectBrowser } from './browser/browser-detect';
import { LocalStorageService } from './local-storage.service';

export class BrowserService {
    // A UI preference: the person has read the notice and doesn't want to
    // see it again. Not a cached detection result; detection runs fresh.
    private _noticeDismissed = LocalStorageService.boolean(
        'browserNoticeDismissed'
    );

    detect(): BrowserDetection {
        const nav: any = typeof navigator === 'undefined' ? {} : navigator;
        const uaData = nav.userAgentData;
        let standalone = !!nav.standalone;

        try {
            standalone =
                standalone ||
                window.matchMedia('(display-mode: standalone)').matches;
        } catch (_ignore) {}

        return detectBrowser({
            userAgent: nav.userAgent || '',
            brands: uaData && Array.isArray(uaData.brands) ? uaData.brands : null,
            platform: (uaData && uaData.platform) || nav.platform || null,
            maxTouchPoints: nav.maxTouchPoints || 0,
            isBrave: !!nav.brave,
            standalone,
        });
    }

    dismissNotice() {
        this._noticeDismissed.setItem(true);
    }

    shouldShowNotice() {
        return !this._noticeDismissed.getItem() && this.detect().showNotice;
    }
}
