import { di } from '../di';
import { html } from 'fudgel';
import { I18nService } from '../i18n/i18n.service';

// Toast service based off of this example:
// https://www.youtube.com/watch?v=EWveKYaX-P0
// https://codepen.io/Coding-in-Public/pen/ZEaKENX

export class ToastService {
    private _i18nService = di(I18nService);
    private _toastContainer: HTMLElement | null = null;

    pop(text: string) {
        this._getContainer().insertAdjacentHTML(
            'beforeend',
            html`<div class="toast">${text}</div>`
        );
        const toast = this._getContainer().lastElementChild!;
        toast.addEventListener('animationend', () => {
            toast.remove();

            if (this._toastContainer && !this._toastContainer.children.length) {
                this._toastContainer.remove();
                this._toastContainer = null;
            }
        });
    }

    popI18n(id: string) {
        this.pop(this._i18nService.get(id));
    }

    _getContainer() {
        if (this._toastContainer) {
            return this._toastContainer;
        }

        document.body.insertAdjacentHTML(
            'beforeend',
            html`<div class="toast-container"></div>
                <style>
                    .toast-container {
                        position: fixed;
                        top: calc(1rem + env(safe-area-inset-top));
                        left: 50%;
                        transform: translateX(-50%);
                        display: grid;
                        justify-items: center;
                        gap: 0.75rem;
                        z-index: 20;
                        pointer-events: none;
                    }

                    .toast {
                        font-size: 1rem;
                        font-weight: 600;
                        line-height: 1.2;
                        padding: 0.75em 1.25em;
                        border-radius: 999px;
                        color: var(--fg);
                        background-color: var(--toast-bg-color);
                        border: var(--toast-border);
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                        white-space: nowrap;
                        animation: toastIt 3000ms
                            cubic-bezier(0.785, 0.135, 0.15, 0.86) forwards;
                    }

                    @keyframes toastIt {
                        0%,
                        100% {
                            transform: translateY(-150%);
                            opacity: 0;
                        }
                        10%,
                        90% {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                </style>`
        );
        this._toastContainer = document.querySelector('.toast-container')!;

        return this._toastContainer;
    }
}
