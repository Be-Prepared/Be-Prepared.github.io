import { component, css, html } from 'fudgel';
import { di } from '../di';
import { QrService } from '../services/qr.service';

export class QrComponent {
    _qrService = di(QrService);
    content = '';
    svg?: HTMLElement;

    onChange() {
        this._update();
    }

    onViewInit() {
        this._update();
    }

    _update() {
        if (this.svg && this.content) {
            this.svg.innerHTML = this._qrService.svg(this.content);
        }
    }
}

component('qr-code', {
    attr: ['content'],
    style: css`
        :host, div {
            display: block;
            height: 100%;
            width: 100%;
        }
    `,
    template: html`
        <div #ref="svg"></div>
    `,
}, QrComponent);
