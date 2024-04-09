import { Component, css, html } from 'fudgel';

@Component('grow-to-fit', {
    style: css`
        :host {
            box-sizing: border-box;
            height: 100%;
            width: 100%;
        }

        .wrapper {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    `,
    template: html`
        <div class="wrapper" #ref="wrapper">
            <div #ref="content"><slot #ref="slot"></slot></div>
        </div>
    `,
    useShadow: true
})
export class GrowToFitComponent {
    #mutationObserver?: MutationObserver;
    #resizeObserver?: ResizeObserver;
    content?: HTMLDivElement;
    slot?: HTMLSlotElement;
    wrapper?: HTMLDivElement;

    onViewInit() {
        this.#findContentSize();
        this.#monitorSizeChanges();
    }

    onDestroy() {
        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
        }

        if (this.#mutationObserver) {
            this.#mutationObserver.disconnect();
        }
    }

    #findContentSize() {
        const wrapper = this.wrapper!;
        const content = this.content!;
        let fz = 1;
        let step = 16;
        const setSize = () => (content.style.fontSize = `${fz}px`);
        const maxWidth = wrapper.clientWidth;
        const maxHeight = wrapper.clientHeight;
        setSize();
        const firstClientHeight = content.clientHeight;
        fz = step;
        setSize();

        // Ensures that there is content
        if (content.clientHeight !== firstClientHeight) {
            // Grow until too high. This makes paragraphs wrap
            // better.
            while (content.clientHeight <= maxHeight) {
                fz += step;
                setSize();
            }

            while (step >= 0.1) {
                if (
                    content.clientHeight > maxHeight ||
                    content.clientWidth > maxWidth
                ) {
                    fz -= step;
                } else {
                    step -= step / 2;
                    fz += step;
                }

                setSize();
            }

            if (
                content.clientHeight > maxHeight ||
                content.clientWidth > maxWidth
            ) {
                fz -= step;
                setSize();
            }
        }
    }

    #monitorSizeChanges() {
        this.#resizeObserver = new ResizeObserver(() =>
            this.#findContentSize()
        );
        this.#resizeObserver.observe(this.wrapper!);
        this.#mutationObserver = new MutationObserver(() =>
            this.#findContentSize()
        );
        this.#mutationObserver.observe(this.slot!, {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
        });
    }
}
