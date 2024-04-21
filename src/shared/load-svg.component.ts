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
    #svg: HTMLElement | null = null;

    onChange() {
        if (this.#svg) {
            this.#clearImage();
            this.#loadImage(this.href);
        }
    }

    onViewInit() {
        this.#loadImage(this.href);
    }

    #apply(svgContent: HTMLElement) {
        const svg = document.importNode(svgContent, true);
        const root = rootElement(this);

        if (!root) {
            return;
        }

        root.appendChild(svg);
        emit(this, 'loadsvg');
        this.#svg = svg;
    }

    #clearImage() {
        if (this.#svg) {
            this.#svg.remove();
            this.#svg = null;
        }
    }

    #loadImage(href: string | undefined) {
        if (!href) {
            return;
        }

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
