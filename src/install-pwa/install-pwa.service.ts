export class InstallPwaService {
    #event: Event | null = null;

    listenForEvents() {
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            this.#event = event;
            this.#showCustomUi();
        });
    }

    triggerSavedEvent() {
        if (this.#event) {
            // Not official enough for TypeScript to include.
            (this.#event as any).prompt();

            // The prompt method can only be used once.
            this.#event = null;
        }
    }

    #showCustomUi() {
        document.body.appendChild(document.createElement('install-pwa'));
    }
}
