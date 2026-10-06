import { di } from '../di';
import { ToastService } from './toast.service';

export class WakeLockService {
    private _currentLock: WakeLockSentinel | null = null;
    private _toastService = di(ToastService);
    private _wanted = false;

    constructor() {
        // Browsers drop the wake lock whenever the page is hidden. Take it
        // back when the page returns.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this._wanted) {
                this._currentLock = null;
                this._getLock();
            }
        });
    }

    // Does not acquire a lock; just checks for the API.
    isSupported() {
        return !!window.navigator.wakeLock;
    }

    release() {
        this._wanted = false;

        if (this._currentLock) {
            this._currentLock.release().catch(() => {});
            this._currentLock = null;
            this._toastService.popI18n('service.wakeLock.released');
        }
    }

    request() {
        if (!this.isSupported() || this._wanted) {
            return Promise.resolve();
        }

        this._wanted = true;

        return this._getLock().then((lock) => {
            if (lock) {
                this._toastService.popI18n('service.wakeLock.obtained');
            }
        });
    }

    private _getLock() {
        return window.navigator.wakeLock.request('screen').then(
            (lock) => {
                if (!this._wanted) {
                    lock.release().catch(() => {});

                    return null;
                }

                this._currentLock = lock;

                return lock;
            },
            () => null
        );
    }
}
