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

        :host, #parent {
            display: flex;
            overflow: none;
            justify-content: center;
            align-items: center;
        }

        #parent {
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
    template: html`<div id="parent"><div id="slot"><slot></slot></div></div>`,
})
export class AppTileComponent {
    #slot?: HTMLElement;

    onViewInit() {
        this.#slot = metadataControllerElement.get(this)!.shadowRoot!.querySelector('#slot')!;
        this.findSlotSize();
    }

    private findSlotSize() {
        if (!this.#slot) {
            return;
        }

        const wrapper = this.#slot.parentElement!;
        const maxWidth = wrapper.clientWidth;
        const maxHeight = wrapper.clientHeight;

        let fz = 1;
        let step = 16;
        this.setSlotSize(fz);

        while (this.#slot.clientHeight <= maxHeight) {
            fz += step;
            this.setSlotSize(fz);
        }

        while (step >= 0.1) {
            if (this.#slot.clientHeight > maxHeight || this.#slot.clientWidth > maxWidth) {
                fz -= step;
            } else {
                step -= step / 2;
                fz += step;
            }

            this.setSlotSize(fz);
        }

        if (this.#slot.clientHeight > maxHeight || this.#slot.clientWidth > maxWidth) {
            fz -= step;
            this.setSlotSize(fz);
        }
    }

    private setSlotSize(fz: number) {
        if (this.#slot) {
            this.#slot.style.fontSize = `${fz}px`;
        }
    }
}
