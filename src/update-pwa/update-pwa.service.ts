import { registerSW } from 'virtual:pwa-register';

export class UpdatePwaService {
    #updateSW: ReturnType<typeof registerSW> | null = null;

    listenForEvents() {
        this.#updateSW = registerSW({
            onNeedRefresh: () => {
                this.#showCustomUi();
            }
        });
        setTimeout(() => this.#showCustomUi(), 1000);
    }

    performUpdate() {
        if (this.#updateSW) {
            this.#updateSW(true);
        }
    }

    #showCustomUi() {
        document.body.appendChild(document.createElement('update-pwa'));
    }
}
