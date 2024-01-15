export class WakeLockService {
    #currentLock: WakeLockSentinel | null = null;

    release() {
        if (this.#currentLock) {
            this.#currentLock.release();
            this.#currentLock = null;
        }
    }

    request() {
        if (!navigator.wakeLock) {
            return;
        }

        navigator.wakeLock.request().then(
            (waitLock) => {
                this.#currentLock = waitLock;
            },
            () => {}
        );
    }
}
