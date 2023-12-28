import { Attr, Component, metadataControllerElement } from 'fudgel';

@Component('load-svg', {
    template: ''
})
export class LoadSvgComponent {
    @Attr() href?: string;

    onChange() {
        if (!this.href) {
            this.#clearImage();
        } else {
            this.#loadImage(this.href);
        }
    }

    #clearImage() {
        const root = this.#getRoot();

        if (root) {
            root.innerHTML = '';
        }
    }

    #loadImage(href: string) {
        const xhr = new XMLHttpRequest;
        xhr.open('get', href, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4 && xhr.responseXML) {
                const svg = document.importNode(xhr.responseXML.documentElement, true);
                const root = this.#getRoot();

                if (root) {
                    root.appendChild(svg);
                }
            }
        };
        xhr.send();
    }

    #getRoot() {
        const root = metadataControllerElement.get(this);

        if (root) {
            return root.shadowRoot!;
        }

        return null;
    }
}
