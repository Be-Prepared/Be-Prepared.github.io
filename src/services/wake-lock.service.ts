import { AvailabilityState } from '../datatypes/availability-state';
import { from, of } from 'rxjs';

export class WakeLockService {
    #currentLock: WakeLockSentinel | null = null;

    availabilityState() {
        if (!window.navigator.wakeLock) {
            return of(AvailabilityState.UNAVAILABLE);
        }

        if (this.#currentLock) {
            return of(AvailabilityState.ALLOWED);
        }

        return from(
            this.#getLock().then((waitLock) => {
                if (waitLock) {
                    waitLock.release();

                    return AvailabilityState.ALLOWED;
                }

                return AvailabilityState.DENIED;
            })
        );
    }

    release() {
        if (this.#currentLock) {
            this.#currentLock.release();
            this.#currentLock = null;
        }
    }

    request() {
        if (!window.navigator.wakeLock) {
            return;
        }

        if (this.#currentLock) {
            return;
        }

        return this.#getLock().then((waitLock) => {
            if (waitLock) {
                this.#currentLock = waitLock;
            }
        });
    }

    #getLock() {
        return window.navigator.wakeLock.request().catch(() => {});
    }
}
