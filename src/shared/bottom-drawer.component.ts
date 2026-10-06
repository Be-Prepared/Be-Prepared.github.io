import { Controller, component, css, html, metadata } from 'fudgel';

let lock = Promise.resolve();

export class BottomDrawerComponent {
    private _lockRelease = () => {};
    private _timeout?: ReturnType<typeof setTimeout>;

    onInit() {
        const element = this._element() as any;
        element.show = () => this._show();
        element.hide = () => this._hide();
    }

    onDestroy() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }

        if (this._lockRelease) {
            this._lockRelease();
        }
    }

    private _hide() {
        if (this._timeout) {
            clearTimeout(this._timeout);
        }

        this._element().style.bottom = `-${this._height()}px`;
        this._timeout = setTimeout(() => this._destroy(), 2000);
    }

    private _show() {
        lock = lock.then(() => {
            return new Promise((resolve) => {
                this._lockRelease = resolve;
                const style = this._element().style;
                style.top = 'auto';
                style.bottom = `-${this._height()}px`;
                this._timeout = setTimeout(() => {
                    style.bottom = '0';
                    this._timeout = setTimeout(() => {
                        this._hide();
                    }, 15000);
                }, 400);
            })
        });
    }

    private _destroy() {
        this._lockRelease();
        this._element().remove();
    }

    private _element() {
        return (this as Controller)[metadata]!.host;
    }

    private _height() {
        // Round any partials up and then add a 1 pixel buffer to ensure no
        // artifacts are visible by accident or with antialiasing.
        const rect = this._element().getBoundingClientRect();

        return Math.ceil(rect.height + 1);
    }
}

component('bottom-drawer', {
    style: css`
        :host {
            top: 200vh;
            position: fixed;
            display: flex;
            transition: bottom 0.5s ease-in-out 0s;
            z-index: 10;
            left: 50%;
            transform: translate(-50%);
        }

        .tab {
            border-top-left-radius: var(--radius-l);
            border-top-right-radius: var(--radius-l);
            border: 1px solid var(--border);
            border-bottom: 0;
            padding: var(--space-3) var(--space-4);
            padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
            background-color: var(--surface);
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.25);
            display: flex;
            align-items: center;
            gap: var(--space-3);
            min-width: min(22rem, 92vw);
            box-sizing: border-box;
        }
    `,
    template: html`
        <div class="tab">
            <slot></slot>
        </div>
    `,
    useShadow: true,
}, BottomDrawerComponent);
