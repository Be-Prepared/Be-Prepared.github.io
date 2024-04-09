import { Component, css, emit, rootElement } from 'fudgel';

@Component('load-svg', {
    attr: ['href'],
    style: css`
        :host {
            display: block;
        }
    `,
    template: '',
})
export class LoadSvgComponent {
    href?: string;
    #deferred = 0;
    #deferredTimeout: null | ReturnType<typeof setTimeout> = null;

    onChange() {
        this.#deferred = 0;

        if (!this.href) {
            this.#clearImage();
        } else {
            this.#loadImage(this.href);
        }
    }

    #apply(svgContent: HTMLElement) {
        const svg = document.importNode(svgContent, true);
        const root = rootElement(this);

        if (!root) {
            this.#deferred = this.#deferred * 2 + 1;
            this.#deferredTimeout = setTimeout(
                () => this.#apply(svgContent),
                this.#deferred
            );
        } else {
            root.appendChild(svg);
            emit(this, 'loadsvg');
        }
    }

    #clearImage() {
        const root = rootElement(this);

        if (root) {
            root.innerHTML = '';
        }

        if (this.#deferredTimeout) {
            clearTimeout(this.#deferredTimeout);
        }
    }

    #loadImage(href: string) {
        const xhr = new XMLHttpRequest();
        xhr.open('get', href, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4 && xhr.responseXML) {
                this.#apply(xhr.responseXML.documentElement);
            }
        };
        xhr.send();
    }
}
