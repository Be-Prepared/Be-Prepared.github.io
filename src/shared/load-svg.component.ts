import { Controller, component, css, emit, metadata } from 'fudgel';

// Cache the parsed files so toolbar icons don't refetch on every screen.
const cache = new Map<string, Promise<Element | null>>();

function fetchSvg(href: string) {
    let promise = cache.get(href);

    if (!promise) {
        promise = new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('get', href, true);
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    resolve(xhr.responseXML?.documentElement || null);
                }
            };
            xhr.send();
        });
        promise.then((result) => {
            if (!result) {
                cache.delete(href);
            }
        });
        cache.set(href, promise);
    }

    return promise;
}

export class LoadSvgComponent {
    href?: string;
    private _loaded: string | undefined;
    private _svg: Element | null = null;
    private _viewReady = false;

    onChange() {
        if (this._viewReady) {
            this._loadImage(this.href);
        }
    }

    onViewInit() {
        this._viewReady = true;
        this._loadImage(this.href);
    }

    private _apply(svgContent: Element) {
        const svg = document.importNode(svgContent, true);
        const root = (this as Controller)[metadata]?.root;

        if (!root) {
            return;
        }

        this._clearImage();
        root.appendChild(svg);
        this._svg = svg;
        emit(this, 'loadsvg');
    }

    private _clearImage() {
        if (this._svg) {
            this._svg.remove();
            this._svg = null;
        }
    }

    private _loadImage(href: string | undefined) {
        if (href === this._loaded) {
            return;
        }

        this._loaded = href;

        if (!href) {
            this._clearImage();

            return;
        }

        fetchSvg(href).then((svg) => {
            // Ignore responses for an href that has since changed.
            if (svg && this._loaded === href) {
                this._apply(svg);
            }
        });
    }
}

component('load-svg', {
    attr: ['href'],
    style: css`
        :host {
            display: block;
        }

        :host > svg {
            display: block;
            width: 100%;
            height: 100%;
        }
    `,
    template: '',
}, LoadSvgComponent);
