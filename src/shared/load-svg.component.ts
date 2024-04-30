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
    private _svg: HTMLElement | null = null;

    onChange() {
        if (this._svg) {
            this._clearImage();
            this._loadImage(this.href);
        }
    }

    onViewInit() {
        this._loadImage(this.href);
    }

    private _apply(svgContent: HTMLElement) {
        const svg = document.importNode(svgContent, true);
        const root = rootElement(this);

        if (!root) {
            return;
        }

        root.appendChild(svg);
        emit(this, 'loadsvg');
        this._svg = svg;
    }

    private _clearImage() {
        if (this._svg) {
            this._svg.remove();
            this._svg = null;
        }
    }

    private _loadImage(href: string | undefined) {
        if (!href) {
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('get', href, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4 && xhr.responseXML) {
                this._apply(xhr.responseXML.documentElement);
            }
        };
        xhr.send();
    }
}
