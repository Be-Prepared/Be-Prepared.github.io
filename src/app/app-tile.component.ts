import { Component, css, html, metadataControllerElement } from 'fudgel';

@Component('app-tile', {
    style: css`
        :host {
            border: 4px solid gray;
            border-radius: 16px;
            box-sizing: border-box;
            padding: 8px;
            background-color: #7f7f7f30;
            margin: 0.5em;
            width: 10em;
            height: 10em;
            cursor: pointer;
        }

        :host, .wrapper {
            display: flex;
            overflow: none;
            justify-content: center;
            align-items: center;
        }

        .wrapper {
            width: 100%;
            max-width: 100%;
            height: 100%;
            max-height: 100%;
        }

        @media (max-width: 60em) {
            :host {
                width: 8em;
                height: 8em;
            }
        }

        @media (max-width: 30em) {
            :host {
                width: 6em;
                height: 6em;
            }
        }
    `,
    template: html`<div class="wrapper" #ref="wrapper"><div #ref="slot"><slot></slot></div></div>`,
})
export class AppTileComponent {
    #resizeObserver?: ResizeObserver;
    slot?: HTMLElement;
    wrapper?: HTMLElement;

    onViewInit() {
        this.#findSlotSize();
        this.#monitorSizeChanges();
    }

    onDestroy() {
        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
        }
    }

    #findSlotSize() {
        const wrapper = this.wrapper!;
        const slot = this.slot!;
        let fz = 1;
        let step = 16;
        const setSize = () => slot.style.fontSize = `${fz}px`;
        const maxWidth = wrapper.clientWidth;
        const maxHeight = wrapper.clientHeight;
        setSize();
        const firstClientHeight = slot.clientHeight;
        fz = step;
        setSize();

        // Ensures that there is content
        if (slot.clientHeight !== firstClientHeight) {
            while (slot.clientHeight <= maxHeight) {
                console.log('grow');
                fz += step;
                setSize();
            }

            while (step >= 0.1) {
                if (slot.clientHeight > maxHeight || slot.clientWidth > maxWidth) {
                    console.log('shrink - too big');
                    fz -= step;
                } else {
                    console.log('shrink - fits');
                    step -= step / 2;
                    fz += step;
                }

                setSize();
            }

            if (slot.clientHeight > maxHeight || slot.clientWidth > maxWidth) {
                console.log('last');
                fz -= step;
                setSize();
            }

            console.log('done', fz);
        }
    }

    #monitorSizeChanges() {
        this.#resizeObserver = new ResizeObserver(() => this.#findSlotSize());
        this.#resizeObserver.observe(this.wrapper!);
    }
}
