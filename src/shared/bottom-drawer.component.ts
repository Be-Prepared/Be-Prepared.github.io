import { Component, css, html, metadataControllerElement } from 'fudgel';

@Component('bottom-drawer', {
    prop: ['hide', 'show'],
    style: css`
        :host {
            top: 200vh;
            position: fixed;
            display: flex;
            transition: bottom 1s ease-in-out 0s;
            left: 50%;
            transform: translate(-50%);
        }

        .tab {
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            border-top: 2px solid;
            border-left: 2px solid;
            border-right: 2px solid;
            padding: 0.3em 0.6em;
            background-color: var(--button-bg-color);
            display: flex;
            align-items: center;
        }
    `,
    template: html`
        <div class="tab">
            <slot></slot>
        </div>
    `,
    useShadow: true,
})
export class BottomDrawerComponent {
    hide?: () => void;
    show?: () => void;
    #timeout?: ReturnType<typeof setTimeout>;

    onInit() {
        const hide = (this.hide = () => {
            if (this.#timeout) {
                clearTimeout(this.#timeout);
            }

            this.#element().style.bottom = `-${this.#height()}px`;
            this.#timeout = setTimeout(() => this.#destroy(), 2000);
        });
        this.show = () => {
            const style = this.#element().style;
            style.top = 'auto';
            style.bottom = `-${this.#height()}px`;
            this.#timeout = setTimeout(() => {
                style.bottom = '0';
                this.#timeout = setTimeout(() => hide(), 15000);
            }, 400);
        };
    }

    onDestroy() {
        if (this.#timeout) {
            clearTimeout(this.#timeout);
        }
    }

    #destroy() {
        this.#element().remove();
    }

    #element() {
        return metadataControllerElement.get(this)!;
    }

    #height() {
        // Round any partials up and then add a 1 pixel buffer to ensure no
        // artifacts are visible by accident or with antialiasing.
        const rect = this.#element().getBoundingClientRect();

        return Math.ceil(rect.height + 1);
    }
}
