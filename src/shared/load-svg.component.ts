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
        this.#getRoot().innerHTML = '';
    }

    #loadImage(href: string) {
        const xhr = new XMLHttpRequest;
        xhr.open('get', href, true);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4 && xhr.responseXML) {
                const svg = document.importNode(xhr.responseXML.documentElement, true);
                this.#getRoot().appendChild(svg);
            }
        };
        xhr.send();
    }

    #getRoot() {
        return metadataControllerElement.get(this)!.shadowRoot!;
    }
}
