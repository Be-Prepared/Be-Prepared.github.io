import { Component, css, html } from 'fudgel';
import { di } from '../di';
import { QrService } from '../services/qr.service';

@Component('mini-qr', {
    attr: ['content'],
    style: css`
        :host {
            position: relative;
            display: block;
        }

        .miniSvg {
            width: 4em;
            height: 4em;
        }
    `,
    template: html`
        <div #ref="miniSvg" class="miniSvg"></div>
    `,
})
export class MiniQrComponent {
    _qrService = di(QrService);
    content = '';
    miniSvg?: HTMLButtonElement;

    onChange() {
        this._update();
    }

    onViewInit() {
        this._update();
    }

    _update() {
        if (this.miniSvg) {
            this.miniSvg.innerHTML = this._qrService.svg(this.content || '');
        }
    }
}
